import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import logo from "./logo.png";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="navbar-left">
          <img src={logo} alt="LevelUp logo" className="logo-icon" />
        </div>

        <nav className="navbar-right">
          <Link to="/login" className="nav-link">
            Login
          </Link>

          <Link to="/login" className="nav-button">
            Get Started
          </Link>

          {/* NEW: Interview Practice link */}
          <button
            type="button"
            className="nav-button"
            onClick={() => navigate("/interview")}
            style={{ marginLeft: 10 }}
          >
            Interview Practice
          </button>
        </nav>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <h1 className="hero-title">Smarter resumes, powered by AI.</h1>
          <p className="hero-subtitle">
            Upload your resume or create a new one in minutes.
          </p>

          <div className="hero-cta">
            <Link to="/login" className="cta-button primary">
              Upload Resume
            </Link>

            <Link to="/login" className="cta-button secondary">
              Create Resume
            </Link>

            {/* NEW: Interview Practice button in hero */}
            <button
              type="button"
              className="cta-button secondary"
              onClick={() => navigate("/interview")}
            >
              Interview Practice
            </button>
          </div>

          <div className="hero-resumes">
            <div className="resume-card resume-left">
              <img
                src="https://static.jobscan.co/blog/uploads/Sales-Resume-Example.png"
                alt="Sales resume example"
              />
            </div>

            <div className="resume-card resume-center">
              <img
                src="https://cdn.enhancv.com/images/1098/i/aHR0cHM6Ly9jZG4uZW5oYW5jdi5jb20vcHJlZGVmaW5lZC1leGFtcGxlcy9haTRERmdYYm00VVE2VGMyNXZpY2h1aWJsVUZHYjV4Nk03ZzljTU9hL2ltYWdlLnBuZw~~.png"
                alt="Student resume example"
              />
            </div>

            <div className="resume-card resume-right">
              <img
                src="https://www.resumehelp.com/wp-content/uploads/2022/11/Student-Resume-Example-RH-1-min.png"
                alt="Modern resume example"
              />
            </div>
          </div>
        </section>

        {/* GREEN SECTION */}
        <section className="section green-section">
          <h2 className="section-title">Way beyond a resume builder...</h2>
          <div className="section-inner">
            <div className="section-text">
              <ul className="feature-list">
                <li>
                  <h3>AI Resume Builder</h3>
                  <p>Smart suggestions to improve your resume instantly.</p>
                </li>
                <li>
                  <h3>Cover Letter Maker</h3>
                  <p>Create tailored cover letters in seconds.</p>
                </li>
                <li>
                  <h3>Mock Interviews</h3>
                  <p>Practice with role-specific questions and sample answers.</p>
                </li>
              </ul>
            </div>

            <div className="section-image">
              <img
                src="https://c.stocksy.com/a/QDV500/z9/1311636.jpg"
                alt="Team collaborating"
                className="section-img"
              />
            </div>
          </div>
        </section>

        {/* ABOUT SECTION */}
        <section className="section white-section" id="about">
          <h2 className="section-title">What we do</h2>
          <div className="section-inner">
            <div className="section-text">
              <p>
                Finding a job today is harder than ever. Crowded markets, complex
                applications, and new tools can feel overwhelming.
              </p>
              <p>
                We built LevelUp to make the process easier for everyone. With
                AI-powered resume building, tailored cover letters, and realistic
                mock interviews, we help you present your best self with confidence.
              </p>
              <p>
                Our goal is to remove the stress and give every job seeker a fair
                chance to stand out.
              </p>
            </div>

            <div className="section-image">
              <img
                src="https://iticollege.edu/wp-content/uploads/2022/10/Practicing-The-Interview-e1665670606809.jpg"
                alt="Interview practice"
                className="section-img"
              />
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-links">
          <Link to="/" className="footer-link">
            Home
          </Link>
          <Link to="/login" className="footer-link">
            Sign Up
          </Link>
          <a href="#about" className="footer-link">
            About Us
          </a>
          <a href="#review" className="footer-link">
            Submit a review
          </a>
        </div>

        <p className="footer-copy">
          © {new Date().getFullYear()} Designed by Team LevelUp
        </p>
      </footer>
    </div>
  );
}

export default Home;
