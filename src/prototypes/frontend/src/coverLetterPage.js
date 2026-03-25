import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  FileText,
  User,
  Cpu,
  Key,
  Upload,
  Sparkles,
  Loader2,
  Download,
  Save,
  Clock,
  Trash2,
  Briefcase // Added for the icon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import "./resumePage.css";        
import "./coverLetterPage.css";  
import Sidebar from "./Sidebar"; 

import { API_URL } from "./config";
import logo from "./logo.png";
import ConfirmModal from "./ConfirmModal";
import { auth } from "./firebase";
import { exportCoverLetterToDocx } from "./exportCoverLetterDocx";

const API_BASE_URL = API_URL;

// --- HELPER: Extracts text from nested objects ---
const cleanString = (val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  
  // If it's an object, try to find the text property
  if (typeof val === "object") {
    return val.text || val.name || val.title || val.company || val.institution || val.value || "";
  }
  return String(val);
};

// --- HELPER: Formats structured resume data into plain text ---
// --- HELPER: Formats structured resume data into plain text ---
const parseDirtyValue = (sourceString, key) => {
  if (!sourceString || typeof sourceString !== 'string') return null;
  
  // Regex looks for: key='(anything inside quotes)'
  const regex = new RegExp(`${key}='([^']*)'`);
  const match = sourceString.match(regex);
  
  if (match && match[1]) {
    // Replace literal "\n" characters with actual newlines
    return match[1].replace(/\\n/g, "\n"); 
  }
  return null;
};
const formatResumeDataToText = (data) => {
    // 1. Header / Name
    let text = `Name: ${cleanString(data.file_name || data.title)}\n`;

    // 2. Summary
    if (data.summary) {
      text += `Summary: ${cleanString(data.summary)}\n`;
    }

    // 3. Experience
    if (data.experience && data.experience.length > 0) {
      text += "\nExperience:\n";
      data.experience.forEach(exp => {
        let companyName = exp.company;
        let jobTitle = exp.title;
        let bullets = exp.bullets;

        // Handle nested object structure if present
        if (typeof exp.company === "object" && exp.company !== null) {
          companyName = exp.company.company || "";
          jobTitle = exp.company.title || jobTitle || "";
          bullets = exp.company.bullets || bullets || [];
        }

        // Format bullets
        let bulletStr = "";
        if (Array.isArray(bullets)) {
          bulletStr = bullets.map(b => cleanString(b)).join(". ");
        } else {
          bulletStr = cleanString(bullets);
        }

        text += `- ${cleanString(jobTitle)} at ${cleanString(companyName)}: ${bulletStr}\n`;
      });
    }

    // 4. Projects (UPDATED PARSING)
    if (data.projects && data.projects.length > 0) {
      text += "\nProjects:\n";
      data.projects.forEach(proj => {
        let projName = proj.name;
        let description = proj.description;

        // CHECK: Is the data "dirty" (contained inside the name string)?
        if (typeof projName === 'string' && projName.includes("name='")) {
            const extractedName = parseDirtyValue(projName, 'name');
            const extractedDesc = parseDirtyValue(projName, 'description');
            
            if (extractedName) projName = extractedName;
            // Only overwrite description if the standard field was empty but we found it in the string
            if (!description && extractedDesc) description = extractedDesc;
        }

        // Clean up newlines for the text block
        const cleanDesc = cleanString(description).replace(/\n/g, ". ");
        text += `- ${cleanString(projName)}: ${cleanDesc}\n`;
      });
    }

    // 5. Education (UPDATED PARSING)
    if (data.education && data.education.length > 0) {
      text += "\nEducation:\n";
      data.education.forEach(edu => {
         let instName = edu.institution;
         let degree = edu.degree;
         let year = edu.year;

         // CHECK: Is the data "dirty" (contained inside the institution string)?
         if (typeof instName === 'string' && instName.includes("institution='")) {
             const extractedInst = parseDirtyValue(instName, 'institution');
             const extractedDegree = parseDirtyValue(instName, 'degree');
             const extractedYear = parseDirtyValue(instName, 'year');

             if (extractedInst) instName = extractedInst;
             if (!degree && extractedDegree) degree = extractedDegree;
             if (!year && extractedYear) year = extractedYear;
         }

         // Fallback formatting if degree/year missing
         const degText = degree ? degree : "Degree";
         const yearText = year ? `(${year})` : "";
         
         text += `- ${degText} from ${cleanString(instName)} ${yearText}\n`;
      });
    }

    // 6. Skills
    if (data.skills) {
      let skillStr = "";
      if (Array.isArray(data.skills)) {
          skillStr = data.skills.map(s => cleanString(s)).join(", ");
      } else {
          skillStr = cleanString(data.skills);
      }
      text += `\nSkills: ${skillStr}\n`;
    }
    
    return text;
};
const CoverLetterPage = () => {
  const navigate = useNavigate();

  // --- Auth & UI State ---
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("Cover Letter");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // --- Configuration ---
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("groq"); 

  // --- Data State ---
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState("");
  
  // --- History State ---
  const [savedLetters, setSavedLetters] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // --- Saved JD State ---
  const [savedJds, setSavedJds] = useState([]);
  const [selectedJdId, setSelectedJdId] = useState("");
  const [isLoadingSavedJds, setIsLoadingSavedJds] = useState(false);
  const [showJdSaveModal, setShowJdSaveModal] = useState(false);
  const [saveJdName, setSaveJdName] = useState("");
  const [isSavingJd, setIsSavingJd] = useState(false);

  // --- Saved Resume State (NEW) ---
  const [savedResumes, setSavedResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [isLoadingResumes, setIsLoadingResumes] = useState(false);

  // --- Loading States ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const [subscriptionTier, setSubscriptionTier] = useState("free"); // "free" | "pro" | "elite"


  // --- Refs ---
  const resumeFileInputRef = useRef(null);
  const coverLetterRef = useRef(null);

  // --- Modal State ---
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
    isDanger: false,
    onConfirm: null,
  });

  const triggerAlert = (title, message, type = "success") => {
    setModalConfig({
      isOpen: true,
      type: "alert",
      title,
      message,
      isDanger: type === "error",
      onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
    });
  };

  // --- HELPER: Parses "dirty" strings like "name='Value' description='Desc'" ---


  // ==============================
  // 1. Auth & Initial Load
  // ==============================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user || null);
      if (user) {
        fetchHistory(user);
        fetchSavedJds(user);
        fetchSavedResumes(user); // Load resumes on init
        user.getIdToken().then((token) => {
          fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .then((profile) => setSubscriptionTier(profile.tier || "free"))
            .catch(() => setSubscriptionTier("free"));
        });
      } else {
        setSavedLetters([]);
        setSavedJds([]);
        setSavedResumes([]);
          setSubscriptionTier("free");
      }
    });
    return () => unsubscribe();
  }, []);

  // ==============================
  // 2. API Helper (Fetch Wrapper)
  // ==============================
const authenticatedFetch = async (endpoint, options = {}) => {
  if (!auth.currentUser) {
    const err = new Error("User not authenticated");
    err.status = 401;
    throw err;
  }

  const token = await auth.currentUser.getIdToken();

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (_) {}

    const message =
      errorData.detail ||
      errorData.message ||
      `API Error (${response.status}): ${response.statusText}`;

    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return response.json();
};


  // ==============================
  // 3. API Actions
  // ==============================

  const fetchHistory = async (user) => {
    setIsLoadingHistory(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/cover_letters`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSavedLetters(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleQuotaError = (err) => {
  const msg = err?.message || "";

  const isQuota =
    err?.status === 429 ||
    msg.includes("429") ||
    msg.toLowerCase().includes("token limit") ||
    msg.toLowerCase().includes("not enough tokens") ||
    msg.toLowerCase().includes("upgrade");

  if (!isQuota) return false;

  setModalConfig({
    isOpen: true,
    type: "confirm",
    title: "Token limit reached",
    message: msg || "You’ve reached your current 5-minute limit for your plan. Upgrade to continue.",
    isDanger: false,
    onConfirm: () => {
      setModalConfig((prev) => ({ ...prev, isOpen: false }));
      navigate("/premium");
    },
  });

  return true;
};


  // --- Saved JD Actions ---
  const fetchSavedJds = async (user = currentUser) => {
    if (!user) return;
    setIsLoadingSavedJds(true);
    try {
      const data = await authenticatedFetch("/job-descriptions", { method: "GET" });
      setSavedJds(Array.isArray(data) ? data : (data.items || []));
    } catch (err) {
      console.error("Failed to load saved JDs:", err);
    } finally {
      setIsLoadingSavedJds(false);
    }
  };

  const handleLoadJd = (id) => {
    setSelectedJdId(id);
    const found = savedJds.find(j => String(j.id) === String(id));
    if (found) {
      setJdText(found.job_description || found.description || "");
    }
  };

  const handleSaveJobDescription = async () => {
    if (!jdText.trim() || jdText.trim().length < 10) {
      triggerAlert("Error", "Job description is too short to save.", "error");
      return;
    }
    if (!saveJdName.trim()) {
      triggerAlert("Error", "Please enter a name for this job description.", "error");
      return;
    }

    setIsSavingJd(true);
    try {
      await authenticatedFetch("/job-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveJdName.trim(),
          job_description: jdText,
          keywords: [] 
        }),
      });

      triggerAlert("Success", "Job description saved successfully!");
      setShowJdSaveModal(false);
      setSaveJdName("");
      fetchSavedJds(currentUser);
    } catch (err) {
      triggerAlert("Save Failed", err.message, "error");
    } finally {
      setIsSavingJd(false);
    }
  };

  // --- Saved Resume Actions (NEW) ---
  const fetchSavedResumes = async (user = currentUser) => {
    if (!user) return;
    setIsLoadingResumes(true);
    try {
      // Fetches the list of resumes (summaries)
      const data = await authenticatedFetch("/resumes", { method: "GET" });
      setSavedResumes(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("Failed to load saved resumes:", err);
    } finally {
      setIsLoadingResumes(false);
    }
  };

  const handleLoadResume = async (resumeId) => {
    setSelectedResumeId(resumeId);
    if (!resumeId) return;

    const resumeSummary = savedResumes.find(r => String(r.resume_id) === String(resumeId));
    if (!resumeSummary) return;

    setIsParsing(true); // Reuse loading state
    try {
        // Fetch the full details of the latest version of this resume
        // Note: authenticatedFetch throws on error, handled in catch
        const fullData = await authenticatedFetch(`/resume_versions/${resumeSummary.version_id}`, { method: "GET" });
        
        // Convert the JSON structure to plain text
        const text = formatResumeDataToText(fullData);
        setResumeText(text);
        
    } catch (err) {
        triggerAlert("Load Failed", "Could not load resume details.", "error");
    } finally {
        setIsParsing(false);
    }
  };

  // --- B. Parse Resume (PDF) ---
  const handleUploadResumePDF = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      triggerAlert("Invalid File", "Please upload a PDF file.", "error");
      return;
    }

    setIsParsing(true);
    try {
      if (!auth.currentUser) throw new Error("Please log in to upload.");
      
      const formData = new FormData();
      formData.append("file", file);

      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/parse_resume`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to parse PDF");
      
      const data = await response.json();
      
      // Use the helper function
      const text = formatResumeDataToText(data);

      setResumeText(text);
      triggerAlert("Success", "Resume parsed successfully!");
    } catch (err) {
      console.error(err);
      triggerAlert("Upload Failed", err.message, "error");
    } finally {
      setIsParsing(false);
      e.target.value = ""; 
    }
  };


// --- C. Generate Cover Letter ---
const generateCoverLetter = async () => {
  if (!resumeText.trim() || !jdText.trim()) {
    triggerAlert("Missing Info", "Please provide both Resume and Job Description.", "error");
    return;
  }

  setIsGenerating(true);

  try {
    const headers = { "Content-Type": "application/json" };

    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/generate_cover_letter`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        resume_text: resumeText,
        jd_text: jdText,
        provider: "groq",
      }),
    });

    // 🔥 HANDLE TOKEN LIMIT HERE
    if (response.status === 429) {
      setModalConfig({
        isOpen: true,
        type: "alert",
        title: "Upgrade Required",
        message: "You’ve reached your current 5-minute token limit. Upgrade your plan to continue.",
        isDanger: false,
        onConfirm: () => {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
          navigate("/premium");
        }
      });
      return;
    }

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Generation failed");
    }

    const data = await response.json();
    setGeneratedCoverLetter(data.cover_letter);
    triggerAlert("Generated", "Cover letter created successfully!");

  } catch (err) {
    // 🔥 EXTRA SAFETY CHECK (if backend returns message but not 429)
    if (err.message?.toLowerCase().includes("token") ||
        err.message?.toLowerCase().includes("upgrade")) {
      
      setModalConfig({
        isOpen: true,
        type: "alert",
        title: "Upgrade Required",
        message: err.message,
        isDanger: false,
        onConfirm: () => {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
          navigate("/premium");
        }
      });
      return;
    }

    triggerAlert("Error", err.message, "error");
  } finally {
    setIsGenerating(false);
  }
};


  const autoResizeTextarea = (ref) => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
    ref.current.style.width = "100%";
    ref.current.style.maxWidth = "100%";
  };

  // IMPORTANT: useLayoutEffect so it resizes before paint
  useLayoutEffect(() => {
    requestAnimationFrame(() => autoResizeTextarea(coverLetterRef));
  }, [generatedCoverLetter]);

  // --- D. Save Cover Letter ---
  const handleSaveToDb = async () => {
    if (!currentUser) {
      triggerAlert("Login Required", "You must be logged in to save.", "error");
      return;
    }
    if (!generatedCoverLetter.trim()) return;

    setIsSaving(true);
    try {
      const companyGuess = (jdText.match(/at\s+([A-Z][A-Za-z0-9&.\- ]+)/)?.[1]) || "Unknown Company";
      const roleGuess = (jdText.match(/(Software Engineer|Developer|Intern|Manager|Analyst)/i)?.[0]) || "General Role";

      await authenticatedFetch("/save_cover_letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: generatedCoverLetter,
          job_title: roleGuess,
          company_name: companyGuess,
          resume_text: resumeText,    
          job_description: jdText     
        }),
      });

      triggerAlert("Saved", "Cover letter and workspace saved!");
      fetchHistory(currentUser); 
    } catch (err) {
      triggerAlert("Save Failed", err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // --- E. Load from History ---
  const loadSavedLetter = (letter) => {
    setGeneratedCoverLetter(letter.content);
    if (letter.resume_text) setResumeText(letter.resume_text);
    if (letter.job_description) setJdText(letter.job_description);
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatCoverLetter = (text) => {
    if (!text) return "";
    return text.replace(/\\n/g, '\n'); // Fix common JSON newline issue
  };

  // --- F. Download DOCX ---
  const handleDownloadCoverLetterDocx = async () => {
    if (!generatedCoverLetter.trim()) {
      triggerAlert("Nothing to download", "Generate a cover letter first.", "error");
      return;
    }
    try {
      await exportCoverLetterToDocx(generatedCoverLetter, "cover_letter");
    } catch (err) {
      triggerAlert("Download failed", err?.message || "Unknown error", "error");
    }
  };

  // ==============================
  // 4. Render
  // ==============================


  return (
    <div className="app-container">
            <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="main-content">
        {/* TOPBAR */}
        <header className="topbar">
          <button onClick={() => setIsSidebarOpen(true)} className="mobile-menu-btn">
            <Menu size={24} />
          </button>

          <div className="controls-group">
            {/* Subscription Tier + Join/Change button */}
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "10px" }}>
    <span
    style={{
      fontSize: "12px",
      fontWeight: 700,
      padding: "4px 10px",
      borderRadius: "999px",
      border: "1px solid #e5e7eb",
      background: subscriptionTier === "free" ? "#f3f4f6" : "#ecfdf5",
      color: subscriptionTier === "free" ? "#374151" : "#065f46",
    }}
    title="Your subscription tier"
  >
    {subscriptionTier === "elite" ? "Elite" : subscriptionTier === "pro" ? "Pro" : "Free"}
  </span>

  <button
    type="button"
    onClick={() => navigate("/premium")}
    style={{
      border: "1px solid #e5e7eb",
      background: "#ffffff",
      padding: "6px 10px",
      borderRadius: "10px",
      fontSize: "12px",
      fontWeight: 600,
      cursor: "pointer",
    }}
  >
    {subscriptionTier === "free" ? "Join Premium" : "Change Subscription"}
  </button>
</div>

            

          </div>

          <div
            className="user-menu"
            onClick={() => (currentUser ? navigate("/account") : navigate("/login"))}
            style={{ cursor: "pointer" }}
          >
            <span>{currentUser ? "My Account" : "Log in"}</span>
            <User size={24} />
          </div>
        </header>

        {/* CONTENT */}
        <div className="scroll-area">
          <div className="container">
            <div className="page-header">
              <h1 className="page-title">Cover Letter Generator</h1>
              <div className="controls-row">
                <div className="btn-group">
                  <button
                    className="btn btn-primary"
                    onClick={generateCoverLetter}
                    disabled={isGenerating || !resumeText || !jdText}
                  >
                    {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    <span>{isGenerating ? "Generating..." : "Generate AI Letter"}</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={handleSaveToDb}
                    disabled={isSaving || !generatedCoverLetter}
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    <span>Save</span>
                  </button>

                  <button
                    className="btn btn-primary"
                    onClick={handleDownloadCoverLetterDocx}
                    style={{ backgroundColor: "#7c3aed" }}
                    disabled={!generatedCoverLetter.trim()}
                  >
                    <Download size={16} />
                    <span>Download DOCX</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="coverletter-layout">
              {/* LEFT PANEL */}
              <div className="coverletter-panel">
                
                {/* 1. History Card */}
                {currentUser && (
                  <div className="cl-card" style={{ marginBottom: "1rem" }}>
                    <div className="cl-card-title" style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <Clock size={16}/> Saved Letters
                    </div>
                    {isLoadingHistory ? (
                      <div style={{padding:"10px", textAlign:"center", color:"#888"}}>Loading...</div>
                    ) : savedLetters.length === 0 ? (
                      <div style={{padding:"10px", fontSize:"0.85rem", color:"#888"}}>No saved letters yet.</div>
                    ) : (
                      <div className="history-list" style={{ maxHeight: "150px", overflowY: "auto" }}>
                        {savedLetters.map((letter) => (
                          <div
                            key={letter.id}
                            onClick={() => loadSavedLetter(letter)}
                            className="history-item"
                            style={{
                              padding: "8px",
                              borderBottom: "1px solid #f3f4f6",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              transition: "background 0.2s"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "#f9fafb"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <div style={{ fontWeight: "600", color: "#374151" }}>{letter.job_title}</div>
                            <div style={{ color: "#6b7280", fontSize: "0.75rem", display:'flex', justifyContent:'space-between' }}>
                              <span>{letter.company_name}</span>
                              <span>{new Date(letter.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Inputs Card */}
                <div className="cl-card">
                  <div className="cl-card-title">Job Details</div>
                  <div className="cl-grid">
                    
                    {/* Resume Input (UPDATED) */}
                    <div>
                      <div className="cl-row" style={{ justifyContent: "space-between", marginBottom:'5px', alignItems: 'flex-end' }}>
                        <span style={{ fontWeight: 600, color: "#374151", fontSize:'0.9rem' }}>Resume</span>
                        
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px'}}>
                            {/* Saved Resume Dropdown */}
                            <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                <span style={{fontSize:'0.7rem', color:'#6b7280'}}>Load Saved:</span>
                                <button 
                                    onClick={() => fetchSavedResumes(currentUser)}
                                    style={{border:'none', background:'none', color:'#2563eb', fontSize:'0.7rem', cursor:'pointer'}}
                                >
                                    {isLoadingResumes ? "..." : "(Refresh)"}
                                </button>
                            </div>
                            <div style={{display:'flex', gap: '5px'}}>
                                <select
                                    className="provider-select"
                                    style={{ padding: "2px 5px", fontSize: "0.75rem", width: "140px" }}
                                    value={selectedResumeId}
                                    onChange={(e) => handleLoadResume(e.target.value)}
                                >
                                    <option value="">-- Select Resume --</option>
                                    {savedResumes.map(r => (
                                        <option key={r.resume_id} value={r.resume_id}>{r.title}</option>
                                    ))}
                                </select>

                                {/* File Upload Button */}
                                <button
                                    className="btn btn-secondary"
                                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                                    onClick={() => resumeFileInputRef.current?.click()}
                                    type="button"
                                    disabled={isParsing}
                                >
                                    {isParsing ? <Loader2 className="animate-spin" size={14}/> : <Upload size={14} />} 
                                </button>
                            </div>
                        </div>

                        <input
                          ref={resumeFileInputRef}
                          type="file"
                          accept=".pdf"
                          style={{ display: "none" }}
                          onChange={handleUploadResumePDF}
                        />
                      </div>
                      <textarea
                        className="editable-input multiline"
                        rows={8}
                        placeholder="Paste your resume text here, or upload a PDF to extract it automatically."
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        style={{ fontSize: "0.85rem", fontFamily: "monospace" }}
                      />
                    </div>

                    {/* Job Description Input (UPDATED) */}
                    <div>
                      {/* Controls Row */}
                      <div className="cl-row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom:'5px' }}>
                        <span style={{ fontWeight: 600, color: "#374151", fontSize:'0.9rem' }}>Job Description</span>
                        
                        {/* Right: Load Dropdown & Refresh */}
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                <span style={{fontSize:'0.7rem', color:'#6b7280'}}>Load Saved:</span>
                                <button 
                                    onClick={() => fetchSavedJds(currentUser)}
                                    style={{border:'none', background:'none', color:'#2563eb', fontSize:'0.7rem', cursor:'pointer'}}
                                >
                                    {isLoadingSavedJds ? "..." : "(Refresh)"}
                                </button>
                            </div>
                            <select
                                className="provider-select"
                                style={{ padding: "2px 5px", fontSize: "0.75rem", width: "180px" }}
                                value={selectedJdId}
                                onChange={(e) => handleLoadJd(e.target.value)}
                            >
                                <option value="">-- Select JD --</option>
                                {savedJds.map(jd => (
                                    <option key={jd.id} value={jd.id}>{jd.name}</option>
                                ))}
                            </select>
                        </div>
                      </div>

                      {/* Text Area */}
                      <textarea
                        className="editable-input multiline"
                        rows={8}
                        placeholder="Paste the Job Description here..."
                        value={jdText}
                        onChange={(e) => {
                            setJdText(e.target.value);
                            if(selectedJdId) setSelectedJdId(""); // Reset dropdown if user types
                        }}
                        style={{ fontSize: "0.85rem" }}
                      />

                      {/* Save Button Row */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowJdSaveModal(true)}
                            disabled={jdText.trim().length < 10}
                            style={{ fontSize: "0.75rem", padding: "4px 8px", height: "auto" }}
                        >
                            <Save size={12} /> Save JD
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL (Preview) */}
              <div className="coverletter-preview">
                <div className="resume-paper" style={{ padding: "40px 50px" }}> 
                  {!generatedCoverLetter.trim() ? (
                    <div className="empty-state">
                      <div>
                        <FileText size={48} style={{ color: "#e5e7eb", margin: "0 auto 1rem" }} />
                        <div style={{fontWeight:'500', color:'#374151'}}>Ready to Write</div>
                        <div style={{ marginTop: "0.5rem", color: "#6b7280", fontSize: "0.85rem" }}>
                          1. Upload your Resume.<br/>
                          2. Paste the Job Description.<br/>
                          3. Click <b>Generate AI Letter</b>.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <textarea 
                      ref={coverLetterRef}
                      className="cl-output-textarea"
                      value={formatCoverLetter(generatedCoverLetter)}
                      onChange={(e) => setGeneratedCoverLetter(e.target.value)}
                      spellCheck={false}
                    />

                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConfirmModal config={modalConfig} setConfig={setModalConfig} />

        {/* SAVE JD MODAL */}
        {showJdSaveModal && (
            <div className="modal-overlay">
            <div className="modal" style={{ width: "400px" }}>
                <button onClick={() => setShowJdSaveModal(false)} className="close-modal-btn">
                <X size={20} />
                </button>
                <h2 className="modal-title">Save Job Description</h2>
                <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "1rem" }}>
                Save this to use in Interview Practice or Resume styling later.
                </p>

                <label className="label" style={{ display: "block", marginBottom: "0.5rem" }}>Name</label>
                <input
                className="api-key-input"
                style={{ width: "100%", marginBottom: "1.5rem", padding: "0.75rem" }}
                value={saveJdName}
                onChange={(e) => setSaveJdName(e.target.value)}
                placeholder="e.g., Google Frontend Intern"
                autoFocus
                />

                <div className="flex gap-2">
                <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, justifyContent: "center" }} 
                    onClick={() => setShowJdSaveModal(false)}
                >
                    Cancel
                </button>
                <button 
                    className="btn btn-primary" 
                    style={{ flex: 1, justifyContent: "center" }} 
                    onClick={handleSaveJobDescription}
                    disabled={isSavingJd || !saveJdName.trim()}
                >
                    {isSavingJd ? <Loader2 className="animate-spin" size={16} /> : "Confirm Save"}
                </button>
                </div>
            </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default CoverLetterPage;
