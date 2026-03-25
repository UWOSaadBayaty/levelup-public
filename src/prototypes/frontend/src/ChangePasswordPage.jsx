
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth } from "./firebase";
import "./LoginPage.css"; 

function ChangePasswordPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        navigate("/login");
      } else {
        setUser(u);
      }
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!user) {
      setError("You must be logged in to change your password.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password should be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);

      setStatus("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      setTimeout(() => navigate("/account"), 2000);
    } catch (err) {
      console.error(err);
      setError("Failed to change password. Please check your current password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="login-page">
        <div style={{ color: "#4b5563" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {}

      <div className="login-card">
        <div className="login-subtitle">Security</div>
        <h1 className="login-title">Change Password</h1>

        {}
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

        {}
        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            Current Password
            <input
              type="password"
              className="login-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
            />
          </label>

          <label className="login-label">
            New Password
            <input
              type="password"
              className="login-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              required
            />
          </label>

          <label className="login-label">
            Confirm New Password
            <input
              type="password"
              className="login-input"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />
          </label>

          <div style={{ marginTop: "0.5rem" }}>
            <button 
              type="submit" 
              className="primary-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Changing..." : "Update Password"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/account")}
              className="secondary-btn" 
              style={{ marginTop: "10px" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div> 
    </div>
  );
}

export default ChangePasswordPage;