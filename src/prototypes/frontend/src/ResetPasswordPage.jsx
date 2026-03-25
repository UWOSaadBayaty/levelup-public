import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import { auth } from "./firebase";
import { ArrowLeft } from "lucide-react"; 
import "./LoginPage.css";

// --- FIX: Moved PageLayout OUTSIDE the main component ---
const PageLayout = ({ children, title = "Set a new password", subtitle = "Recovery", navigate }) => (
  <div className="login-page">
    <div className="login-card">
      <button
        className="back-home-btn"
        onClick={() => navigate("/login")}
      >
        <ArrowLeft size={16} />
        Back to Login
      </button>

      <p className="login-subtitle">{subtitle}</p>
      <h1 className="login-title">{title}</h1>
      {children}
    </div>
  </div>
);

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isVerifying, setIsVerifying] = useState(true);
  const [oobCode, setOobCode] = useState(null);

  useEffect(() => {
    const code = searchParams.get("oobCode");
    if (!code) {
      setError("Invalid or missing password reset code.");
      setIsVerifying(false);
      return;
    }

    setOobCode(code);

    verifyPasswordResetCode(auth, code)
      .then(() => {
        setIsVerifying(false);
      })
      .catch((err) => {
        console.error(err);
        setError("This password reset link is invalid or has expired.");
        setIsVerifying(false);
      });
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!oobCode) {
      setError("Missing reset code.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus("Password has been reset successfully. You can now log in.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error(err);
      setError("Failed to reset password. The link may have expired.");
    }
  };

  if (isVerifying) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center" }}>
           <p style={{ color: "#4b5563" }}>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (error && !oobCode) {
    // Note: Passed navigate prop here
    return (
      <PageLayout title="Invalid Link" navigate={navigate}>
        <div className="login-error">{error}</div>
      </PageLayout>
    );
  }

  return (
    // Note: Passed navigate prop here
    <PageLayout navigate={navigate}>
      
      {status && (
        <div style={{ 
          color: "#059669", 
          backgroundColor: "#ecfdf5", 
          padding: "0.75rem", 
          borderRadius: "6px", 
          marginBottom: "1rem", 
          fontSize: "0.85rem",
          border: "1px solid #d1fae5"
        }}>
          {status}
        </div>
      )}

      
      {error && <p className="login-error">{error}</p>}

      {!status && (
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            New Password
            <input
              type="password"
              className="login-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
          </label>

          <label className="login-label">
            Confirm New Password
            <input
              type="password"
              className="login-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </label>

          <button 
            type="submit" 
            className="primary-btn"
            style={{ marginTop: "0.5rem" }}
          >
            Reset Password
          </button>
        </form>
      )}
    </PageLayout>
  );
}

export default ResetPasswordPage;