import os

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.deps import get_user_repo
from app.core.user_repo import UserRepo
from app.models.user_profile import UserProfile

router = APIRouter(tags=["stripe"])

# --- Stripe config (from env only) ---
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

PRICE_MAP = {
    "pro": os.getenv("STRIPE_PRICE_PRO", ""),
    "elite": os.getenv("STRIPE_PRICE_ELITE", ""),
}


class CheckoutBody(BaseModel):
    plan: str  # "pro" or "elite"


@router.post("/create-checkout-session")
def create_checkout_session(
    body: CheckoutBody,
    user: UserProfile = Depends(get_current_user),
):
    if not stripe.api_key:
        raise HTTPException(
            status_code=500,
            detail="Stripe secret key is not configured. Set STRIPE_SECRET_KEY env var.",
        )

    plan = (body.plan or "").strip().lower()

    if plan == "free":
        return {"url": f"{FRONTEND_URL}/dashboard/resume"}

    if plan not in PRICE_MAP:
        raise HTTPException(status_code=400, detail="Invalid plan. Use: free, pro, elite")

    metadata = {
        "plan": plan,
        "user_id": user.firebase_uid,
    }

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": PRICE_MAP[plan], "quantity": 1}],
            success_url=f"{FRONTEND_URL}/dashboard/resume?upgraded={plan}",
            cancel_url=f"{FRONTEND_URL}/premium",
            metadata=metadata,
            client_reference_id=user.firebase_uid,
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    repo: UserRepo = Depends(get_user_repo),
):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    event_type = event["type"]
    data_object = event["data"]["object"]

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data_object, repo)

    elif event_type in (
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        _handle_subscription_change(data_object, repo)

    return {"status": "ok"}


@router.get("/subscription-details")
def subscription_details(
    user: UserProfile = Depends(get_current_user),
):
    if user.tier == "free":
        return {"tier": "free", "active": False}

    from app.core.db import db_cursor
    with db_cursor() as cur:
        cur.execute(
            "SELECT stripe_subscription_id FROM users WHERE firebase_id = %s",
            (user.firebase_uid,),
        )
        row = cur.fetchone()

    sub_id = row[0] if row else None
    if not sub_id:
        return {"tier": user.tier, "active": False}

    try:
        sub = stripe.Subscription.retrieve(sub_id)
        # Stripe API v2024+: current_period_end lives on the subscription item
        items = sub.get("items", {}).get("data", [])
        item_period_end = items[0].get("current_period_end") if items else None
        period_end = (
            sub.get("current_period_end")
            or sub.get("cancel_at")
            or item_period_end
            or None
        )
        return {
            "tier": user.tier,
            "active": sub.status in ("active", "trialing"),
            "cancel_at_period_end": sub.cancel_at_period_end,
            "current_period_end": period_end,
            "status": sub.status,
        }
    except Exception:
        return {"tier": user.tier, "active": False}


@router.post("/cancel-subscription")
def cancel_subscription(
    user: UserProfile = Depends(get_current_user),
):
    if user.tier == "free":
        raise HTTPException(status_code=400, detail="You are already on the free plan.")

    from app.core.db import db_cursor
    with db_cursor() as cur:
        cur.execute(
            "SELECT stripe_subscription_id FROM users WHERE firebase_id = %s",
            (user.firebase_uid,),
        )
        row = cur.fetchone()

    sub_id = row[0] if row else None
    if not sub_id:
        raise HTTPException(status_code=400, detail="No active subscription found.")

    try:
        sub = stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")

    # Store cancellation info in local DB so it's visible in Supabase
    items = sub.get("items", {}).get("data", [])
    item_period_end = items[0].get("current_period_end") if items else None
    cancel_at = sub.get("cancel_at") or sub.get("current_period_end") or item_period_end

    with db_cursor() as cur:
        cur.execute(
            """UPDATE users
               SET subscription_status = 'cancel_scheduled',
                   cancel_at = %s
             WHERE firebase_id = %s""",
            (cancel_at, user.firebase_uid),
        )

    return {"status": "cancel_scheduled", "cancel_at": cancel_at}


@router.post("/resume-subscription")
def resume_subscription(
    user: UserProfile = Depends(get_current_user),
):
    if user.tier == "free":
        raise HTTPException(status_code=400, detail="You are on the free plan.")

    from app.core.db import db_cursor
    with db_cursor() as cur:
        cur.execute(
            "SELECT stripe_subscription_id FROM users WHERE firebase_id = %s",
            (user.firebase_uid,),
        )
        row = cur.fetchone()

    sub_id = row[0] if row else None
    if not sub_id:
        raise HTTPException(status_code=400, detail="No active subscription found.")

    try:
        stripe.Subscription.modify(sub_id, cancel_at_period_end=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume subscription: {str(e)}")

    # Clear cancellation info in local DB
    with db_cursor() as cur:
        cur.execute(
            """UPDATE users
               SET subscription_status = 'active',
                   cancel_at = NULL
             WHERE firebase_id = %s""",
            (user.firebase_uid,),
        )

    return {"status": "resumed"}


def _handle_checkout_completed(session: dict, repo: UserRepo):
    metadata = session.get("metadata", {})
    firebase_uid = metadata.get("user_id")
    plan = metadata.get("plan", "free")

    if not firebase_uid:
        print("[Stripe Webhook] checkout.session.completed missing user_id in metadata")
        return

    stripe_customer_id = session.get("customer")
    stripe_subscription_id = session.get("subscription")

    repo.update_tier(
        firebase_uid=firebase_uid,
        tier=plan,
        stripe_customer_id=stripe_customer_id,
        stripe_subscription_id=stripe_subscription_id,
        subscription_status="active",
    )
    print(f"[Stripe Webhook] User {firebase_uid} upgraded to {plan}")


def _handle_subscription_change(subscription: dict, repo: UserRepo):
    status = subscription.get("status", "")
    customer_id = subscription.get("customer")

    if not customer_id:
        print("[Stripe Webhook] subscription event missing customer id")
        return

    user = repo.get_by_stripe_customer_id(customer_id)
    if not user:
        print(f"[Stripe Webhook] No user found for stripe customer {customer_id}")
        return

    if status in ("active", "trialing"):
        return

    repo.update_tier(
        firebase_uid=user.firebase_uid,
        tier="free",
        subscription_status=status,
    )
    print(f"[Stripe Webhook] User {user.firebase_uid} downgraded to free (status: {status})")
