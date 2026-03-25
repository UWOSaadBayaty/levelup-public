import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./firebase";
import { ArrowLeft } from "lucide-react"; 
import "./LoginPage.css";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");
    setError("");
    setIsSubmitting(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setStatus("Password reset link sent. Please check your email.");
    } catch (err) {
      console.error(err);
      setError("Failed to send reset email. Please check the email address.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">



      <div className="login-card">
        {}
        <button
          className="back-home-btn"
          onClick={() => navigate("/login")}
        >
          <ArrowLeft size={16} />
          Back to Login
        </button>

        <p className="login-subtitle">Recovery</p>
        <h1 className="login-title">Reset your password</h1>

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
            Email Address
            <input
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              required
            />
          </label>

          <button 
            type="submit" 
            className="primary-btn"
            disabled={isSubmitting}
            style={{ marginTop: "0.5rem" }}
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;