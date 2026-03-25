
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { API_URL } from "./config";
import ConfirmModal from "./ConfirmModal";
import "./DeleteAccountPage.css";

function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState("free");
  const [subDetails, setSubDetails] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
    isDanger: false,
    onConfirm: null,
  });

  const triggerConfirm = (title, message, onConfirm, isDanger = false) => {
    setModalConfig({
      isOpen: true,
      type: "confirm",
      title,
      message,
      isDanger,
      onConfirm,
    });
  };

  const triggerAlert = (title, message, type = "success") => {
    setModalConfig({
      isOpen: true,
      type: "alert",
      title,
      message,
      isDanger: type === "error",
      onConfirm: null,
    });
  };

  const fetchSubscriptionDetails = async (token) => {
    try {
      const resp = await fetch(`${API_URL}/subscription-details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setSubDetails(data);
        setTier(data.tier || "free");
      }
    } catch {
      setSubDetails(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);

      if (!u) {
        navigate("/login");
      } else {
        u.getIdToken().then((token) => {
          fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .then((profile) => {
              setTier(profile.tier || "free");
              if (profile.tier && profile.tier !== "free") {
                fetchSubscriptionDetails(token);
              }
            })
            .catch(() => setTier("free"));
        });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("idToken");
      navigate("/login");
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  const goBackToDashboard = () => {
    navigate("/dashboard/resume");
  };

  const goToChangePassword = () => {
    navigate("/change-password");
  };

  const goToDeleteAccount = () => {
    navigate("/delete-account");
  };

  const handleCancelAutoRenewal = async () => {
    triggerConfirm(
      "Cancel Auto-Renewal",
      "Are you sure you want to cancel auto-renewal? You will keep your subscription until the end of the current billing period.",
      async () => {
        setActionLoading(true);
        try {
          const token = await user.getIdToken();
          const resp = await fetch(`${API_URL}/cancel-subscription`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await resp.json();
          if (!resp.ok) {
            triggerAlert("Cancel Failed", data.detail || "Failed to cancel auto-renewal.", "error");
          } else {
            await fetchSubscriptionDetails(token);
            triggerAlert(
              "Auto-Renewal Canceled",
              "You'll keep your subscription until the end of the current billing period."
            );
          }
        } catch (err) {
          triggerAlert("Request Failed", "Something went wrong. Please try again.", "error");
          console.error(err);
        } finally {
          setActionLoading(false);
        }
      },
      true
    );
  };

  const handleResumeSubscription = async () => {
    setActionLoading(true);
    try {
      const token = await user.getIdToken();
      const resp = await fetch(`${API_URL}/resume-subscription`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        triggerAlert("Resume Failed", data.detail || "Failed to resume subscription.", "error");
      } else {
        await fetchSubscriptionDetails(token);
        triggerAlert("Subscription Resumed", "Auto-renewal is back on.");
      }
    } catch (err) {
      triggerAlert("Request Failed", "Something went wrong. Please try again.", "error");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="login-page">
        <div style={{ color: "#4b5563" }}>Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="login-page">

      <div className="login-card">
        <div className="login-subtitle">Profile</div>
        <h1 className="login-title">My Account</h1>

        <div className="login-form">
          {}
          <label className="login-label">
            Email
            <input
              type="text"
              className="login-input"
              value={user.email}
              readOnly
              style={{ background: "#f9fafb", color: "#6b7280" }}
            />
          </label>

          {}
          <label className="login-label">
            User ID
            <input
              type="text"
              className="login-input"
              value={user.uid}
              readOnly
              style={{ background: "#f9fafb", color: "#6b7280", fontSize: "0.8rem" }}
            />
          </label>

          {/* Subscription tier */}
          <label className="login-label">
            Subscription
            <div style={{
              padding: "10px 14px", background: "#f9fafb", borderRadius: "8px",
              border: "1px solid #e5e7eb", marginTop: "4px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{
                  padding: "2px 10px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: 600,
                  background: tier === "free" ? "#f3f4f6" : "#ecfdf5",
                  color: tier === "free" ? "#374151" : "#065f46",
                }}>
                  {tier === "elite" ? "Elite" : tier === "pro" ? "Pro" : "Free"}
                </span>

                {tier !== "free" && subDetails?.cancel_at_period_end && (
                  <span style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 500 }}>
                    Cancels at end of period
                  </span>
                )}

                {tier === "free" && (
                  <button
                    onClick={() => navigate("/premium")}
                    style={{
                      marginLeft: "auto", padding: "4px 12px", fontSize: "0.8rem",
                      background: "transparent", border: "1px solid #2563eb", color: "#2563eb",
                      borderRadius: "6px", cursor: "pointer",
                    }}
                  >
                    Upgrade
                  </button>
                )}
              </div>

              {tier !== "free" && subDetails?.current_period_end && (
                <div style={{ marginTop: "8px", fontSize: "0.82rem", color: "#6b7280" }}>
                  {subDetails.cancel_at_period_end
                    ? `Your ${tier === "elite" ? "Elite" : "Pro"} plan ends on ${formatDate(subDetails.current_period_end)}.`
                    : `Next renewal: ${formatDate(subDetails.current_period_end)}`}
                </div>
              )}

              {tier !== "free" && (
                <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                  {subDetails?.cancel_at_period_end ? (
                    <button
                      onClick={handleResumeSubscription}
                      disabled={actionLoading}
                      style={{
                        padding: "4px 12px", fontSize: "0.8rem",
                        background: "transparent", border: "1px solid #16a34a", color: "#16a34a",
                        borderRadius: "6px", cursor: actionLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {actionLoading ? "Processing..." : "Resume Subscription"}
                    </button>
                  ) : (
                    <button
                      onClick={handleCancelAutoRenewal}
                      disabled={actionLoading}
                      style={{
                        padding: "4px 12px", fontSize: "0.8rem",
                        background: "transparent", border: "1px solid #ef4444", color: "#ef4444",
                        borderRadius: "6px", cursor: actionLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {actionLoading ? "Processing..." : "Cancel Auto-Renewal"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </label>

          {}
          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "10px" }}>

            {}
            <button onClick={goToChangePassword} className="primary-btn">
              Change Password
            </button>

            {}
            <button onClick={goBackToDashboard} className="secondary-btn">
              ← Back to Dashboard
            </button>
            
            <button onClick={handleLogout} className="secondary-btn">
              Log out
            </button>

            {}
            <hr style={{ border: "0", borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />

            {}
            <button onClick={goToDeleteAccount} className="primary-btn btn-danger">
              Delete My Account
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal config={modalConfig} setConfig={setModalConfig} />
    </div>
  );
}

export default AccountPage;
