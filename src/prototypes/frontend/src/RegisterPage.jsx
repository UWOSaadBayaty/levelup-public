import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import "./LoginPage.css";

import { API_URL } from "./config";
const BACKEND_URL = API_URL;

function RegisterPage() {
  const navigate = useNavigate();

  const [firstName, setFirstName]       = useState("");
  const [lastName, setLastName]         = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError]               = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const firebaseUser = userCredential.user;

      const idToken = await firebaseUser.getIdToken();

      try {
        await fetch(`${BACKEND_URL}/auth/bootstrap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            name: `${firstName} ${lastName}`.trim(),
          }),
        });
      } catch (err) {
        console.warn(
          "Backend bootstrap failed (user still exists in Firebase):",
          err
        );
      }

      navigate("/login");
    } catch (firebaseErr) {
      console.error(firebaseErr);
      setError(firebaseErr.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
   
      <div className="login-card">
        <p className="login-subtitle">Please enter your details</p>
        <h1 className="login-title">Create an account</h1>

        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleRegister} className="login-form">
        <div className="name-row">
  <label className="login-label name-field">
    First Name
    <input
      className="login-input"
      type="text"
      value={firstName}
      onChange={(e) => setFirstName(e.target.value)}
      required
    />
  </label>

  <label className="login-label name-field">
    Last Name
    <input
      className="login-input"
      type="text"
      value={lastName}
      onChange={(e) => setLastName(e.target.value)}
      required
    />
  </label>
</div>

          <label className="login-label">
            Email
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="login-label">
            Password
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <label className="login-label">
            Confirm Password
            <input
              className="login-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="primary-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </button>

          <button
            type="button"
            className="google-btn"
            onClick={() => {}}
          >
            <span className="google-icon">G</span>
            <span>Sign up with Google</span>
          </button>
        </form>

        <p className="signup-text">
          Already have an account?{" "}
          <button
            type="button"
            className="signup-link"
            onClick={() => navigate("/login")}
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
