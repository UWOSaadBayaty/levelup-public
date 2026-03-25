import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { auth } from "./firebase";
import "./DeleteAccountPage.css";
import { signOut } from "firebase/auth";

import ConfirmModal from "./ConfirmModal";

import { API_URL } from "./config";
const API_BASE = API_URL;

function DeleteAccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
    isDanger: false,
    onConfirm: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) navigate("/login");
      else setUser(u);
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handlePreCheck = (e) => {
    e.preventDefault();
    setError("");

    if (!user) {
      setError("You must be logged in.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setModalConfig({
      isOpen: true,
      type: "confirm",
      isDanger: true,
      title: "Confirm Deletion",
      message:
        "Are you sure you want to permanently delete your account? You will not be able to recover your data.",
      onConfirm: performDelete,
    });
  };

  const performDelete = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      if (!user) throw new Error("Not logged in.");

      // 1) Re-authenticate (Firebase requires recent login to delete)
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // 2) Grab an ID token BEFORE deleting the Firebase account
      // (token will still be valid briefly right after)
      const idToken = await user.getIdToken(true);

      // 3) Delete Firebase Auth user (this is what actually removes them from Firebase)
      await deleteUser(user);

      // 4) Delete the DB user row (cascades to resumes/etc.)
      const res = await fetch(`${API_BASE}/auth/account`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const msg = await res.text();
        // At this point Firebase is already deleted; DB might not be.
        // Surface this clearly so you know you need cleanup.
        throw new Error(
          `Firebase deleted, but DB delete failed: ${msg || res.status}`
        );
      }

      // 5) Cleanup local session
      localStorage.removeItem("idToken");
      try {
        await signOut(auth);
      } catch (_) {
        // safe to ignore: user may already be signed out after deleteUser
      }

      setModalConfig({
        isOpen: true,
        type: "alert",
        title: "Account Deleted",
        message:
          "Your account has been successfully deleted (Firebase + database). You will be redirected shortly.",
        onConfirm: () => navigate("/login"),
      });

      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      console.error(err);

      const msg = String(err?.message || "");

      // More helpful messages for the common cases
      if (msg.includes("auth/wrong-password")) {
        setError("Wrong password. Please try again.");
      } else if (msg.includes("auth/requires-recent-login")) {
        setError("Please log in again, then try deleting your account.");
      } else if (msg.includes("Firebase deleted, but DB delete failed")) {
        setError(
          "Your Firebase account was deleted, but the database cleanup failed. Tell Bilal to run the DB cleanup script or retry."
        );
      } else {
        setError("Failed to delete account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
      // close confirm modal after action
      setModalConfig((c) => ({ ...c, isOpen: false }));
    }
  };

  if (loadingUser) return <div className="login-page">Loading...</div>;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-subtitle">Danger Zone</div>
        <h1 className="login-title">Delete My Account</h1>
        <div className="warning-text">
          <strong>Warning:</strong> This action is permanent.
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handlePreCheck} className="login-form">
          <label className="login-label">
            Password
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <label className="login-label">
            Confirm Password
            <input
              type="password"
              className="login-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="primary-btn btn-danger"
          >
            {isSubmitting ? "Deleting..." : "Permanently Delete Account"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/account")}
            className="secondary-btn"
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </form>
      </div>

      <ConfirmModal config={modalConfig} setConfig={setModalConfig} />
    </div>
  );
}

export default DeleteAccountPage;
