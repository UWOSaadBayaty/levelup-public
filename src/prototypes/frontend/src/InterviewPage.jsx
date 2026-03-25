import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import "./interviewPage.css";

import { API_URL } from "./config";
const API_BASE = API_URL;

// NOTE: provider/model are now hidden from the UI.
// You can hardcode defaults here (and backend can ignore these if it wants).
const DEFAULT_PROVIDER = "groq";
const DEFAULT_MODEL = "";

export default function InterviewPage() {
  const auth = getAuth();

  // Core interview state
  const [jobDescription, setJobDescription] = useState("");
  const [questionType, setQuestionType] = useState("technical");
  const [difficulty, setDifficulty] = useState("easy");

  const [question, setQuestion] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [scoreResult, setScoreResult] = useState(null);

  const [loadingQ, setLoadingQ] = useState(false);
  const [loadingS, setLoadingS] = useState(false);
  const [error, setError] = useState("");

  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState("");


  // Saved job descriptions
  const [savedJobs, setSavedJobs] = useState([]); // [{id, name, job_description, created_at}]
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Save modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savingJob, setSavingJob] = useState(false);

  async function getTokenOrThrow() {
    const user = auth.currentUser;
    if (!user) throw new Error("Not logged in");
    return await user.getIdToken();
  }

  async function refreshSavedJobs() {
    setError("");
    setLoadingSaved(true);
    try {
      const token = await getTokenOrThrow();

      // IMPORTANT:
      // Your backend route must match this. If your router is prefixed like /job-descriptions,
      // then this should be `${API_BASE}/job-descriptions`.
      const resp = await fetch(`${API_BASE}/job-descriptions`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || "Failed to load saved job descriptions");

      // Accept either {items:[...]} or [...]
      const items = Array.isArray(data) ? data : (data.items || []);
      setSavedJobs(items);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoadingSaved(false);
    }
  }
  

  async function loadSelectedJob() {
    setError("");
    const found = savedJobs.find((x) => String(x.id) === String(selectedSavedId));
    if (!found) return;

    // If backend stores under different key names, handle both.
    const jd = found.job_description || found.description || found.text || "";
    setJobDescription(jd);

    // Clear current question/answer because JD changed
    setQuestion(null);
    setAnswerText("");
    setScoreResult(null);
  }

  async function saveJobDescription() {
    setError("");
    if (jobDescription.trim().length < 10) {
      setError("Job description is too short to save.");
      return;
    }
    if (saveName.trim().length < 2) {
      setError("Please enter a name (at least 2 characters).");
      return;
    }

    setSavingJob(true);
    try {
      const token = await getTokenOrThrow();

      const resp = await fetch(`${API_BASE}/job-descriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: saveName.trim(),
          job_description: jobDescription,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || "Failed to save job description");

      setShowSaveModal(false);
      setSaveName("");
      await refreshSavedJobs();

      // auto-select the newly created row if backend returns it
      if (data?.id) setSelectedSavedId(String(data.id));
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSavingJob(false);
    }
  }

  async function generateQuestion() {
    setError("");
    setScoreResult(null);
    setLoadingQ(true);

    try {
      const token = await getTokenOrThrow();

      const resp = await fetch(`${API_BASE}/interview/question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_description: jobDescription,
          question_type: questionType,
          difficulty,
          provider: DEFAULT_PROVIDER,
          model: DEFAULT_MODEL,
        }),
      });

      const data = await resp.json().catch(() => ({}));

      // If quota exceeded, show upgrade popup (backend returns 429)
      if (resp.status === 429) {
        const detail = data?.detail;
        const msg =
          (typeof detail === "string" && detail) ||
          detail?.message ||
          "You don’t have enough tokens left to generate a question. Please upgrade to continue.";

        setUpgradeMsg(msg);
        setShowUpgradePopup(true);
        return;
      }

      if (!resp.ok) throw new Error(data?.detail || "Failed to generate question");


      setQuestion(data);
      setAnswerText("");
      setScoreResult(null);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoadingQ(false);
    }
  }

  async function scoreAnswer() {
    if (!question?.id) return;

    setError("");
    setLoadingS(true);

    try {
      const token = await getTokenOrThrow();

      const resp = await fetch(`${API_BASE}/interview/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question_id: question.id,
          job_description: jobDescription,
          answer_text: answerText,
          provider: DEFAULT_PROVIDER,
          model: DEFAULT_MODEL,
        }),
      });

      const data = await resp.json().catch(() => ({}));

      // If quota exceeded, show upgrade popup (backend returns 429)
      if (resp.status === 429) {
        const detail = data?.detail;
        const msg =
          (typeof detail === "string" && detail) ||
          detail?.message ||
          "You don’t have enough tokens left to score this answer. Please upgrade to continue.";

        setUpgradeMsg(msg);
        setShowUpgradePopup(true);
        return;
      }

      if (!resp.ok) throw new Error(data?.detail || "Failed to score answer");


      setScoreResult(data);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoadingS(false);
    }
  }

  const canGenerate = jobDescription.trim().length >= 10 && !loadingQ;
  const canScore = answerText.trim().length >= 1 && !loadingS && question?.id;

  const typeLabel = useMemo(() => {
    const t = (questionType || "").toLowerCase();
    if (t === "system-design") return "System Design";
    if (t === "behavioral") return "Behavioral";
    return "Technical";
  }, [questionType]);

  const difficultyLabel = useMemo(() => {
    const d = (difficulty || "").toLowerCase();
    if (d === "hard") return "Hard";
    if (d === "medium") return "Medium";
    return "Easy";
  }, [difficulty]);

  useEffect(() => {
    // Auto-load saved job descriptions when page mounts
    refreshSavedJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="interview-page">
      <div className="interview-shell">
        <header className="interview-header">
          <div className="title-wrap">
            <h1 className="interview-title">Interview Practice</h1>
            <p className="interview-subtitle">
              Save a job description, generate a question, then score your answer.
            </p>
          </div>

          <div className="interview-badges">
            <span className="pill">
              <span className="pill-label">Difficulty</span>
              <b className="pill-value">{difficultyLabel}</b>
            </span>
            <span className="pill">
              <span className="pill-label">Type</span>
              <b className="pill-value">{typeLabel}</b>
            </span>
          </div>
        </header>

        {error && (
          <div className="alert">
            <b>Error:</b> {error}
          </div>
        )}

        <div className="grid-2">
          {/* LEFT: Job Description */}
          <section className="card card-stretch">
            <div className="card-head">
              <h2 className="card-title">1) Job Description</h2>
              <span className="card-hint">Used to tailor the question and scoring.</span>
            </div>

            {/* Saved JD Toolbar */}
            <div className="saved-jd">
              <div className="saved-jd-row">
                <div className="field grow">
                  <label className="label">Saved Job Descriptions</label>
                  <select
                    className="select"
                    value={selectedSavedId}
                    onChange={(e) => setSelectedSavedId(e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {savedJobs.map((x) => (
                      <option key={x.id} value={String(x.id)}>
                        {x.name || `Saved #${x.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="saved-jd-actions">
                  <button className="btn btn-light" onClick={refreshSavedJobs} disabled={loadingSaved}>
                    {loadingSaved ? "Refreshing..." : "Refresh"}
                  </button>

                  <button className="btn btn-light" onClick={loadSelectedJob} disabled={!selectedSavedId}>
                    Load
                  </button>

                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowSaveModal(true);
                      setSaveName("");
                    }}
                    disabled={jobDescription.trim().length < 10}
                  >
                    Save As…
                  </button>
                </div>
              </div>
            </div>

            <textarea
              className="textarea textarea-grow"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={10}
              placeholder="Paste the job description here..."
            />

            <div className="controls controls-compact">
              <div className="field">
                <label className="label">Question Type</label>
                <select className="select" value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                  <option value="technical">Technical</option>
                  <option value="behavioral">Behavioral</option>
                  <option value="system-design">System Design</option>
                </select>
              </div>

              <div className="field">
                <label className="label">Difficulty</label>
                <select className="select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <button className="btn btn-primary span-2" onClick={generateQuestion} disabled={!canGenerate}>
                {loadingQ ? "Generating…" : "Generate Question"}
              </button>
            </div>
          </section>

          {/* RIGHT: Answer */}
          <section className="card card-stretch">
            <div className="card-head">
              <h2 className="card-title">2) Your Answer</h2>
              <span className="card-hint">Write your response, then score it.</span>
            </div>

            <div className="answer-stack">
              <textarea
                className="textarea textarea-grow"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                rows={10}
                placeholder={question ? "Write your answer here..." : "Generate a question first..."}
                disabled={!question}
              />

              <div className="answer-actions">
                <button className="btn btn-secondary" onClick={scoreAnswer} disabled={!canScore}>
                  {loadingS ? "Scoring…" : "Score Answer"}
                </button>

                {scoreResult && (
                  <div className="score-pill">
                    Score <b>{scoreResult.score}</b> / 100
                  </div>
                )}
              </div>

              {scoreResult && (
                <div className="result">
                  {Array.isArray(scoreResult.feedback) && scoreResult.feedback.length > 0 && (
                    <div className="result-block">
                      <h4 className="result-title">Feedback</h4>
                      <ul className="list">
                        {scoreResult.feedback.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(scoreResult.improve_next) && scoreResult.improve_next.length > 0 && (
                    <div className="result-block">
                      <h4 className="result-title">Improve Next</h4>
                      <ul className="list">
                        {scoreResult.improve_next.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* QUESTION */}
        <section className="card card-wide">
          <div className="card-head">
            <h2 className="card-title">3) Question</h2>
            <span className="card-hint">
              {question ? "Generated question + LeetCode practice." : "Generate a question to see it here."}
            </span>
          </div>

          {!question ? (
            <div className="empty">
              <div className="empty-title">No question yet</div>
              <div className="empty-subtitle">Paste a job description and click “Generate Question”.</div>
            </div>
          ) : (
            <>
              <div className="question-text">{question.question_text}</div>

              {Array.isArray(question.leetcode_links) && question.leetcode_links.length > 0 && (
                <div className="leetcode">
                  <div className="leetcode-head">
                    <h4 className="leetcode-title">LeetCode Practice</h4>
                    <span className="leetcode-hint">Suggested based on tags.</span>
                  </div>

                  <div className="leetcode-pills">
                    {question.leetcode_links.map((x, idx) => (
                      <a
                        key={idx}
                        className="leetcode-pill"
                        href={x.url}
                        target="_blank"
                        rel="noreferrer"
                        title={x.title || x.url}
                      >
                        {x.title || "LeetCode Link"}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
            {/* Upgrade Popup (Token Limit) */}
      {showUpgradePopup && (
        <div className="modal-overlay" onMouseDown={() => setShowUpgradePopup(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">Upgrade required</h3>
              <button
                className="icon-btn"
                onClick={() => setShowUpgradePopup(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p style={{ marginTop: 0 }}>
              {upgradeMsg || "You don’t have enough tokens left to complete this request. Please upgrade to continue."}
            </p>

            <div className="modal-actions">
              <button className="btn btn-light" onClick={() => setShowUpgradePopup(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => window.location.assign("/premium")}
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Save Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onMouseDown={() => setShowSaveModal(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">Save Job Description</h3>
              <button className="icon-btn" onClick={() => setShowSaveModal(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <label className="label">Name</label>
            <input
              className="input"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g., Shopify Frontend Intern"
              autoFocus
            />

            <div className="modal-actions">
              <button className="btn btn-light" onClick={() => setShowSaveModal(false)} disabled={savingJob}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveJobDescription} disabled={savingJob}>
                {savingJob ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
