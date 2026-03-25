import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { ArrowLeft } from "lucide-react"; 
import "./LoginPage.css";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  const formatTime = (ms) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const paddedSeconds = seconds.toString().padStart(2, "0");
    return `${minutes}:${paddedSeconds}`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/dashboard/resume");
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const storedLockout = localStorage.getItem("loginLockoutUntil");
    if (storedLockout) {
      const lockoutUntil = parseInt(storedLockout, 10);
      const diff = lockoutUntil - Date.now();
      if (diff > 0) {
        setLockoutTime(diff);
      } else {
        localStorage.removeItem("loginLockoutUntil");
        localStorage.removeItem("loginFailedCount");
      }
    }
  }, []);

  useEffect(() => {
    if (lockoutTime <= 0) return;

    const interval = setInterval(() => {
      const stored = localStorage.getItem("loginLockoutUntil");
      if (!stored) {
        setLockoutTime(0);
        clearInterval(interval);
        return;
      }

      const diff = parseInt(stored, 10) - Date.now();
      if (diff <= 0) {
        localStorage.removeItem("loginLockoutUntil");
        localStorage.removeItem("loginFailedCount");
        setLockoutTime(0);
        clearInterval(interval);
      } else {
        setLockoutTime(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutTime]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (lockoutTime > 0) {
      setError(`Too many failed attempts. Please wait ${formatTime(lockoutTime)} before trying again.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      localStorage.setItem("idToken", idToken);

      localStorage.removeItem("loginFailedCount");
      localStorage.removeItem("loginLockoutUntil");

      navigate("/dashboard/resume");
    } catch (err) {
      console.error(err);
      const failCount = parseInt(localStorage.getItem("loginFailedCount") || "0", 10) + 1;

      if (failCount >= MAX_FAILED_ATTEMPTS) {
        localStorage.setItem("loginFailedCount", "0");
        const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
        localStorage.setItem("loginLockoutUntil", lockoutUntil.toString());
        setLockoutTime(LOCKOUT_DURATION_MS);
        setError("Too many failed attempts. Login temporarily locked. Please wait before trying again.");
      } else {
        localStorage.setItem("loginFailedCount", failCount.toString());
        setError("Invalid email or password.");
      }
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
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={16} />
          Back to Home
        </button>

        <p className="login-subtitle">Please enter your details</p>
        <h1 className="login-title">Welcome back</h1>

        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleLogin} className="login-form">
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

          <button
            type="button"
            className="forgot-link"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot Password?
          </button>

          <button
            type="submit"
            className="primary-btn"
            disabled={isSubmitting || lockoutTime > 0}
          >
            {lockoutTime > 0
              ? `Locked (${formatTime(lockoutTime)})`
              : isSubmitting
              ? "Logging in..."
              : "Sign In"}
          </button>

          <button
            type="button"
            className="google-btn"
            onClick={() => {}}
          >
            <span className="google-icon">G</span>
            <span>Sign in with Google</span>
          </button>
        </form>

        <p className="signup-text">
          Dont have an account?{" "}
          <button
            type="button"
            className="signup-link"
            onClick={() => navigate("/register")}
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;