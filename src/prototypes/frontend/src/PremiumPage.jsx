import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Crown, Loader2, Menu, Sparkles } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { API_URL } from "./config";
import Sidebar from "./Sidebar";
import "./resumePage.css";
import "./premiumPage.css";

const PLAN_LIMITS = {
  free: 2000,
  pro: 5000,
  elite: 15000,
};

const PLAN_LABELS = {
  free: "Free",
  pro: "Pro",
  elite: "Elite",
};

const normalizeTier = (tier) => (["free", "pro", "elite"].includes(tier) ? tier : "free");

export default function PremiumPage() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTier, setCurrentTier] = useState("free");
  const [selected, setSelected] = useState("free");
  const [isTierLoading, setIsTierLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const plans = useMemo(
    () => [
      {
        id: "free",
        name: "Free",
        price: "$0",
        subtitle: `Up to ${PLAN_LIMITS.free.toLocaleString()} tokens every 5 minutes`,
        description: "Good for trying the workflow and occasional edits.",
        features: [
          `${PLAN_LIMITS.free.toLocaleString()} token cap per 5-minute window`,
          "Resume tools and core editing features",
          "Interview and cover letter tools with lighter usage",
          "Best for occasional applications",
        ],
      },
      {
        id: "pro",
        name: "Pro",
        price: "$9.99/mo",
        subtitle: `Up to ${PLAN_LIMITS.pro.toLocaleString()} tokens every 5 minutes`,
        description: "Balanced for active applicants using AI throughout the week.",
        features: [
          `${PLAN_LIMITS.pro.toLocaleString()} token cap per 5-minute window`,
          "More AI generations before hitting limits",
          "Better fit for frequent resume tailoring",
          "Recommended for steady job search workflows",
        ],
        badge: "Most Popular",
      },
      {
        id: "elite",
        name: "Elite",
        price: "$14.99/mo",
        subtitle: `Up to ${PLAN_LIMITS.elite.toLocaleString()} tokens every 5 minutes`,
        description: "For heavy usage across resumes, cover letters, and interview prep.",
        features: [
          `${PLAN_LIMITS.elite.toLocaleString()} token cap per 5-minute window`,
          "Largest usage window for intensive sessions",
          "Best for multi-role applications and practice loops",
          "Most room for repeated AI-assisted iterations",
        ],
      },
    ],
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user || null);

      if (!user) {
        setCurrentTier("free");
        setSelected("free");
        setIsTierLoading(false);
        return;
      }

      setIsTierLoading(true);

      try {
        const token = await user.getIdToken();
        const resp = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!resp.ok) {
          throw new Error("Failed to load profile");
        }

        const profile = await resp.json();
        const tier = normalizeTier(profile.tier);
        setCurrentTier(tier);
        setSelected(tier);
      } catch (err) {
        console.error("Failed to load premium tier:", err);
        setCurrentTier("free");
        setSelected("free");
      } finally {
        setIsTierLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const selectedPlan = plans.find((plan) => plan.id === selected) || plans[0];
  const currentPlan = plans.find((plan) => plan.id === currentTier) || plans[0];
  const isSelectedCurrentPlan = selected === currentTier;
  const isDowngradeSelection = currentTier !== "free" && selected === "free";

  const getPrimaryActionLabel = () => {
    if (isTierLoading) return "Loading plan";
    if (isCheckoutLoading) return "Redirecting";
    if (isSelectedCurrentPlan) {
      return currentTier === "free" ? "Back to dashboard" : "Manage subscription";
    }
    if (isDowngradeSelection) {
      return "Manage subscription";
    }
    return `Upgrade to ${selectedPlan.name}`;
  };

  const handleContinue = async () => {
    if (isTierLoading || isCheckoutLoading) return;

    if (isSelectedCurrentPlan) {
      navigate(currentTier === "free" ? "/dashboard/resume" : "/account");
      return;
    }

    if (isDowngradeSelection) {
      navigate("/account");
      return;
    }

    if (!currentUser) {
      navigate("/login");
      return;
    }

    setIsCheckoutLoading(true);

    try {
      const idToken = await currentUser.getIdToken();
      const resp = await fetch(`${API_URL}/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ plan: selected }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        alert(data.detail || "Failed to start checkout");
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    <div className="app-container premium-app">
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab=""
        setActiveTab={() => {}}
      />

      <main className="main-content">
        <header className="topbar premium-topbar">
          <button type="button" onClick={() => setIsSidebarOpen(true)} className="mobile-menu-btn">
            <Menu size={24} />
          </button>

          <div className="premium-topbar-copy">
            <span className="premium-topbar-kicker">Billing</span>
            <span className="premium-topbar-heading">Premium Plans</span>
          </div>

          <div className="controls-group premium-topbar-actions">
            <span className={`tier-pill ${currentTier !== "free" ? "paid" : ""}`}>
              Current: {PLAN_LABELS[currentTier]}
            </span>
            <button type="button" className="premium-ghost-btn" onClick={() => navigate("/account")}>
              Account
            </button>
          </div>
        </header>

        <div className="scroll-area">
          <div className="container premium-container">
            <section className="premium-hero">
              <div className="premium-hero-copy">
                <div className="premium-eyebrow">
                  <Crown size={16} />
                  <span>LevelUp Premium</span>
                </div>
                <h1 className="premium-title">Pick the plan that matches how you actually use the app.</h1>
                <p className="premium-subtitle">
                  Your current tier is selected automatically. All plans use rolling 5-minute token windows for resume,
                  cover letter, and interview features.
                </p>

                <div className="premium-highlights">
                  <div className="premium-highlight">
                    <span className="premium-highlight-value">5 min</span>
                    <span className="premium-highlight-label">Reset window</span>
                  </div>
                  <div className="premium-highlight">
                    <span className="premium-highlight-value">{PLAN_LABELS[currentTier]}</span>
                    <span className="premium-highlight-label">Current tier</span>
                  </div>
                  <div className="premium-highlight">
                    <span className="premium-highlight-value">Instant</span>
                    <span className="premium-highlight-label">Checkout redirect</span>
                  </div>
                </div>
              </div>

              <aside className="premium-status-card">
                <div className="premium-status-label">Selected plan</div>
                <div className="premium-status-name">{selectedPlan.name}</div>
                <div className="premium-status-price">{selectedPlan.price}</div>
                <p className="premium-status-text">{selectedPlan.description}</p>

                <div className="premium-status-note">
                  <Sparkles size={16} />
                  <span>
                    {isTierLoading
                      ? "Checking your subscription tier."
                      : isSelectedCurrentPlan
                        ? `You are already on ${selectedPlan.name}.`
                        : isDowngradeSelection
                          ? "Moving back to Free is handled from the account page."
                          : `You are upgrading from ${currentPlan.name} to ${selectedPlan.name}.`}
                  </span>
                </div>
              </aside>
            </section>

            <section className="premium-grid" aria-label="Premium plans">
              {plans.map((plan) => {
                const isSelected = selected === plan.id;
                const isCurrent = currentTier === plan.id;

                return (
                  <article
                    key={plan.id}
                    className={[
                      "premium-plan-card",
                      isSelected ? "selected" : "",
                      isCurrent ? "current" : "",
                      plan.badge ? "featured" : "",
                    ].join(" ")}
                    onClick={() => setSelected(plan.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(plan.id);
                      }
                    }}
                  >
                    <div className="premium-plan-top">
                      <div className="premium-plan-meta">
                        <div className="premium-plan-badges">
                          {plan.badge && <span className="premium-plan-badge">{plan.badge}</span>}
                          {isCurrent && <span className="premium-plan-badge current">Current Plan</span>}
                        </div>
                        <h2 className="premium-plan-name">{plan.name}</h2>
                        <div className="premium-plan-price">{plan.price}</div>
                        <p className="premium-plan-subtitle">{plan.subtitle}</p>
                      </div>

                      <div className={`premium-plan-selector ${isSelected ? "selected" : ""}`} aria-hidden="true" />
                    </div>

                    <p className="premium-plan-description">{plan.description}</p>

                    <ul className="premium-plan-features">
                      {plan.features.map((feature) => (
                        <li key={feature} className="premium-plan-feature">
                          <span className="premium-plan-check">
                            <Check size={14} />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className={`premium-select-btn ${isSelected ? "selected" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(plan.id);
                      }}
                    >
                      {isCurrent ? "Current plan" : isSelected ? "Selected" : `Select ${plan.name}`}
                    </button>
                  </article>
                );
              })}
            </section>

            <footer className="premium-footer">
              <div className="premium-footer-copy">
                <div className="premium-footer-label">Ready to continue</div>
                <div className="premium-footer-title">
                  {selectedPlan.name} plan
                  <span className="premium-footer-detail"> {selectedPlan.subtitle}</span>
                </div>
                {isDowngradeSelection && (
                  <div className="premium-footer-note">
                    To switch back to Free, cancel auto-renewal from your account page.
                  </div>
                )}
              </div>

              <div className="premium-footer-actions">
                <button type="button" className="premium-ghost-btn" onClick={() => navigate("/dashboard/resume")}>
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  className="premium-primary-btn"
                  onClick={handleContinue}
                  disabled={isTierLoading || isCheckoutLoading}
                >
                  {isCheckoutLoading || isTierLoading ? <Loader2 size={16} className="premium-spin" /> : null}
                  <span>{getPrimaryActionLabel()}</span>
                </button>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
