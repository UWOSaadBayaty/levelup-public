// src/resumePage.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  Upload, FileText, ChevronLeft, ChevronRight, X, Menu, User,
  AlertCircle, CheckCircle, Plus, Sparkles, Loader2, Key, Cpu,
  FolderOpen, Trash2, Save, Briefcase, Target, Download
} from "lucide-react";
import "./resumePage.css";
import "./DeleteAccountPage.css";
import { exportResumeToDocx } from "./exportdocx";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import logo from './logo.png';
import ConfirmModal from "./ConfirmModal";
import InterviewPage from "./InterviewPage";
import Sidebar from "./Sidebar";

import { API_URL } from "./config";
const BACKEND_URL = API_URL;

// --- Components ---

const EditableText = ({ value, onSave, className = "", placeholder = "Click to edit...", multiline = false, tag = "span" }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) { onSave(localValue); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !multiline) { handleBlur(); }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          className={`editable-input multiline ${className}`}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          rows={3}
        />
      );
    }
    return (
      <input
        autoFocus
        type="text"
        className={`editable-input ${className}`}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  }

  const Tag = tag;
  return (
    <Tag
      className={`editable-text ${className}`}
      onClick={() => setIsEditing(true)}
      title="Click to edit"
    >
      {value || <span className="text-gray-400 italic">{placeholder}</span>}
    </Tag>
  );
};

// --- Normalization Helpers ---
const cleanEducationString = (str) => {
  if (!str || typeof str !== "string") return { institution: "", degree: "", year: "" };
  let s = str;
  const yearMatch = s.match(/year='([^']*)'/);
  const year = yearMatch ? yearMatch[1] : "";
  if (s.includes("degree=") || s.includes("institution=")) {
    s = s
      .replace(/^\s*institution='?/, "")
      .replace(/'\s*year='[^']*'?\s*$/, "")
      .replace(/\s*degree='?/, "")
      .replace(/'/g, "");
  }
  return { institution: s.trim(), degree: "", year };
};

const normalizeEducation = (raw) => {
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries
    .filter((e) => e != null)
    .map((entry) => {
      if (entry.institution && typeof entry.institution === "object" && entry.institution.institution) {
        return {
          institution: entry.institution.institution || "",
          degree: entry.institution.degree || "",
          year: entry.institution.year || ""
        };
      }
      if (typeof entry === "object" && entry !== null) {
        const instVal = entry.institution;
        if (typeof instVal === "string" && instVal.includes("degree=")) {
          const cleaned = cleanEducationString(instVal);
          return { institution: cleaned.institution, degree: cleaned.degree, year: cleaned.year };
        }
        return {
          institution: typeof instVal === "string" ? instVal : "",
          degree: entry.degree || "",
          year: entry.year || ""
        };
      }
      return cleanEducationString(String(entry));
    });
};

const parseProjectRepr = (s) => {
  if (!s || typeof s !== "string") return { name: "", description: "", tech_stack: [], links: [] };
  const nameMatch = s.match(/name='([^']*)'/);
  const descMatch = s.match(/description='([\s\S]*?)'\s*(tech_stack=|\s*$)/);
  const techMatch = s.match(/tech_stack=\[([^\]]*)\]/);
  const linksMatch = s.match(/links=\[([^\]]*)\]/);
  return {
    name: nameMatch ? nameMatch[1] : "",
    description: descMatch ? descMatch[1].replace(/\\n/g, "\n") : s.replace(/\\n/g, "\n"),
    tech_stack: techMatch
      ? techMatch[1].split(",").map((t) => t.replace(/['\s]/g, "")).filter(Boolean)
      : [],
    links: linksMatch
      ? linksMatch[1].split(",").map((t) => t.replace(/['\s]/g, "")).filter(Boolean)
      : []
  };
};

const normalizeProjects = (raw) => {
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries
    .filter((e) => e != null)
    .map((entry) => {
      const formatDesc = (desc) => {
        if (!desc) return "";
        if (Array.isArray(desc)) return desc.join("\n");
        if (typeof desc === "object") return JSON.stringify(desc);
        return String(desc).replace(/\\n/g, "\n");
      };

      if (entry.name && typeof entry.name === 'object' && (entry.name.name || entry.name.description)) {
        return {
          name: entry.name.name || "",
          description: formatDesc(entry.name.description),
          tech_stack: entry.name.tech_stack || [],
          links: entry.name.links || []
        };
      }

      if (typeof entry === "object") {
        if (typeof entry.name === "string" && entry.name.includes("description=")) {
          const parsed = parseProjectRepr(entry.name);
          const descFromField = entry.description != null ? formatDesc(entry.description) : "";
          const useDesc = descFromField && descFromField.trim().length > 0 ? descFromField : parsed.description;
          return { ...parsed, description: useDesc };
        }

        return {
          name: entry.name || "",
          description: formatDesc(entry.description),
          tech_stack: Array.isArray(entry.tech_stack) ? entry.tech_stack : [],
          links: Array.isArray(entry.links) ? entry.links : []
        };
      }

      return parseProjectRepr(String(entry));
    });
};

const normalizeExperience = (raw) => {
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries
    .filter((e) => e != null)
    .map((entry) => {
      let data = entry;
      if (entry.title && typeof entry.title === "object" && entry.title.title) data = entry.title;
      else if (entry.company && typeof entry.company === "object" && entry.company.company) data = entry.company;

      const getString = (val) => (typeof val === "string" ? val : typeof val === "number" ? String(val) : "");

      return {
        company: getString(data.company),
        title: getString(data.title),
        start_date: getString(data.start_date),
        end_date: getString(data.end_date),
        bullets: Array.isArray(data.bullets)
          ? data.bullets.map((b) => {
            if (typeof b === "string") return b;
            if (typeof b === "object" && b !== null) return b.text || b.bullet || JSON.stringify(b);
            return String(b);
          })
          : []
      };
    });
};

const formatDateRange = (start, end) => {
  if (!start && !end) return "";
  if (start && !end) return start;
  if (!start && end) return end;
  return `${start} – ${end}`;
};

// --- Resume Paper Component ---
const ResumePaper = React.forwardRef(({ data, onOptimizeBullet, onUploadReq, onUpdate }, ref) => {
  const education = normalizeEducation(data?.education);
  const experience = normalizeExperience(data?.experience);
  const projects = normalizeProjects(data?.projects);
  const skillsList = Array.isArray(data?.skills)
    ? data.skills
    : typeof data?.skills === "string"
      ? data.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const hasAnyContent =
    data &&
    ((data.header && data.header.length > 0) ||
      data.summary ||
      education.length > 0 ||
      experience.length > 0 ||
      projects.length > 0 ||
      skillsList.length > 0);

  const updateHeader = (val, index) => {
    const newHeader = [...(data.header || [])];
    newHeader[index] = val;
    onUpdate({ ...data, header: newHeader });
  };

  const updateSummary = (val) => { onUpdate({ ...data, summary: val }); };

  const updateEducation = (index, field, val) => {
    const newEdu = [...education];
    newEdu[index] = { ...newEdu[index], [field]: val };
    onUpdate({ ...data, education: newEdu });
  };

  const updateExperience = (index, field, val) => {
    const newExp = [...experience];
    newExp[index] = { ...newExp[index], [field]: val };
    onUpdate({ ...data, experience: newExp });
  };

  const updateExperienceBullet = (expIndex, bulletIndex, val) => {
    const newExp = [...experience];
    const newBullets = [...newExp[expIndex].bullets];
    newBullets[bulletIndex] = val;
    newExp[expIndex].bullets = newBullets;
    onUpdate({ ...data, experience: newExp });
  };

  const deleteExperienceBullet = (expIndex, bulletIndex) => {
    const newExp = [...experience];
    newExp[expIndex].bullets = newExp[expIndex].bullets.filter((_, i) => i !== bulletIndex);
    onUpdate({ ...data, experience: newExp });
  };

  const updateProject = (index, field, val) => {
    const newProjs = [...projects];
    newProjs[index] = { ...newProjs[index], [field]: val };
    onUpdate({ ...data, projects: newProjs });
  };

  const updateProjectBullet = (projIndex, bulletIndex, val) => {
    const newProjs = [...projects];
    const lines = (newProjs[projIndex].description || "").split('\n');
    lines[bulletIndex] = val;
    newProjs[projIndex].description = lines.join('\n');
    onUpdate({ ...data, projects: newProjs });
  };

  const updateSkills = (val) => { onUpdate({ ...data, skills: val.split(",").map(s => s.trim()) }); };

  if (!hasAnyContent) {
    return (
      <div className="resume-paper" ref={ref}>
        <div className="empty-state">
          <div>
            <div>Upload a resume to get started.</div>
            <div className="empty-action" onClick={onUploadReq} style={{ cursor: 'pointer' }}>
              (Use the green button above.)
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="resume-paper" ref={ref}>
      <div className="resume-header">
        <EditableText tag="h1" className="resume-name" value={data.header?.[0]} onSave={(v) => updateHeader(v, 0)} />
        <div className="resume-info">
          <EditableText
            value={data.header?.slice(1).join(" • ")}
            onSave={(val) => {
              const parts = val.split("•").map(s => s.trim());
              onUpdate({ ...data, header: [data.header[0], ...parts] });
            }}
          />
        </div>
      </div>

      <div className="resume-content">
        {data.summary && (
          <section className="resume-section">
            <h2 className="section-title">Summary</h2>
            <EditableText multiline value={data.summary} onSave={updateSummary} />
          </section>
        )}

        {education.length > 0 && (
          <section className="resume-section">
            <h2 className="section-title">Education</h2>
            {education.map((edu, i) => (
              <div key={i} className="item-header">
                <div>
                  <EditableText className="item-title block" value={edu.institution} onSave={(v) => updateEducation(i, 'institution', v)} />
                  <EditableText className="item-subtitle block" value={edu.degree} onSave={(v) => updateEducation(i, 'degree', v)} />
                </div>
                <EditableText className="item-date" value={edu.year} onSave={(v) => updateEducation(i, 'year', v)} />
              </div>
            ))}
          </section>
        )}

        {experience.length > 0 && (
          <section className="resume-section">
            <h2 className="section-title">Experience</h2>
            {experience.map((exp, i) => (
              <div key={i} style={{ marginBottom: "1rem" }}>
                <div className="item-header">
                  <div>
                    <EditableText className="item-title block" value={exp.title} onSave={(v) => updateExperience(i, 'title', v)} />
                    <EditableText className="item-subtitle block" value={exp.company} onSave={(v) => updateExperience(i, 'company', v)} />
                  </div>
                  <div className="item-date">
                    <EditableText
                      value={formatDateRange(exp.start_date, exp.end_date)}
                      onSave={(v) => { updateExperience(i, 'start_date', v); updateExperience(i, 'end_date', ''); }}
                    />
                  </div>
                </div>

                {exp.bullets && exp.bullets.length > 0 && (
                  <ul className="item-bullets">
                    {exp.bullets.map((b, bi) => (
                      <li key={bi} className="bullet-row group relative" data-section="experience" data-item={i} data-bullet={bi}>
                        <div className="bullet-inner">
                          <EditableText multiline className="bullet-text" value={b} onSave={(v) => updateExperienceBullet(i, bi, v)} />
                          <div className="bullet-actions">
                            <button type="button" className="bullet-opt-btn" onClick={() => onOptimizeBullet("experience", i, bi, b)}>
                              <Sparkles size={12} />
                            </button>
                            <button type="button" className="bullet-del-btn" onClick={() => deleteExperienceBullet(i, bi)}>
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {projects.length > 0 && (
          <section className="resume-section">
            <h2 className="section-title">Projects</h2>
            {projects.map((proj, i) => (
              <div key={i} style={{ marginBottom: "1rem" }}>
                <div className="item-header" style={{ marginBottom: "0.25rem" }}>
                  <EditableText className="item-title" value={proj.name} onSave={(v) => updateProject(i, 'name', v)} />
                </div>

                {proj.description && (
                  <ul className="item-bullets">
                    {proj.description.split("\n").map((line) => line.trim()).filter(Boolean).map((line, bi) => (
                      <li key={bi} className="bullet-row" data-section="projects" data-item={i} data-bullet={bi}>
                        <div className="bullet-inner">
                          <EditableText multiline className="bullet-text" value={line} onSave={(v) => updateProjectBullet(i, bi, v)} />
                          <button type="button" className="bullet-opt-btn" onClick={() => { onOptimizeBullet("projects", i, bi, line); }}>
                            <Sparkles size={12} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {skillsList.length > 0 && (
          <section className="resume-section">
            <h2 className="section-title">Skills</h2>
            <EditableText multiline className="skills-text" value={skillsList.join(", ")} onSave={updateSkills} />
          </section>
        )}
      </div>
    </div>
  );
});

// --- Main App Component ---
const App = () => {
  const [saveName, setSaveName] = useState("");
  const [isSavingJd, setIsSavingJd] = useState(false);
  const [showJdSaveModal, setShowJdSaveModal] = useState(false);
  const [savedJds, setSavedJds] = useState([]);
  const [selectedJdId, setSelectedJdId] = useState("");
  const [isLoadingSavedJds, setIsLoadingSavedJds] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState("free"); // "free" | "pro" | "elite"

  const navigate = useNavigate();
  const location = useLocation();
  const isInterviewRoute = location.pathname === "/interview";

  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("Resumes");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [resumes, setResumes] = useState([]);
  const [currentResumeIndex, setCurrentResumeIndex] = useState(0);

  const [optimizedText, setOptimizedText] = useState("");


  // --- Modals State ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
  const [showMyResumesDrawer, setShowMyResumesDrawer] = useState(true);

  // --- Job Context State (New Feature) ---
  const [isJdPanelOpen, setIsJdPanelOpen] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdKeywords, setJdKeywords] = useState([]);
  const [isAnalyzingJd, setIsAnalyzingJd] = useState(false);

  
// True when backend response indicates token limit / upgrade needed
const needsUpgrade = (() => {
  const msg = String(optimizedText || "");
  // common patterns you showed:
  // "Error: 429: Token limit reached..."
  // "Error: 429: You do not have enough tokens..."
  return /(^|\b)429\b/.test(msg) && /(upgrade|token|limit|free tier)/i.test(msg);
})();

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
      onConfirm: () => {
        onConfirm();
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };
  const handleSaveJobDescription = async () => {
  if (!jdText.trim() || jdText.trim().length < 10) {
    triggerAlert("Error", "Job description is too short to save.", "error");
    return;
  }
  if (!saveName.trim()) {
    triggerAlert("Error", "Please enter a name for this job description.", "error");
    return;
  }
  if (!currentUser) return;

  setIsSavingJd(true);
  try {
    const idToken = await currentUser.getIdToken();
    const resp = await fetch(`${BACKEND_URL}/job-descriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        name: saveName.trim(),
        job_description: jdText,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.detail || "Failed to save job description");

    triggerAlert("Success", "Job description saved successfully!", "success");
    setShowJdSaveModal(false);
    setSaveName("");
  } catch (err) {
    triggerAlert("Save Failed", err.message, "error");
  } finally {
    setIsSavingJd(false);
  }
};
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
  const refreshSavedJds = async () => {
  if (!currentUser) return;
  setIsLoadingSavedJds(true);
  try {
    const idToken = await currentUser.getIdToken();
    const resp = await fetch(`${BACKEND_URL}/job-descriptions`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error("Failed to fetch saved jobs");
    
    // Support both array response or {items: []}
    setSavedJds(Array.isArray(data) ? data : (data.items || []));
  } catch (err) {
    console.error(err);
  } finally {
    setIsLoadingSavedJds(false);
  }
};

const handleLoadJd = (id) => {
  setSelectedJdId(id);
  const found = savedJds.find(j => String(j.id) === String(id));
  if (found) {
    setJdText(found.job_description || found.description || "");
    setJdKeywords([]); // Clear keywords when a new JD is loaded
  }
};

// Auto-fetch when the JD panel is opened
useEffect(() => {
  if (isJdPanelOpen && currentUser) {
    refreshSavedJds();
  }
}, [isJdPanelOpen, currentUser]);

  // ✅ keep sidebar selection in sync with route
  useEffect(() => {
    if (isInterviewRoute) setActiveTab("Interview Practice");
    else setActiveTab("Resumes");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInterviewRoute]);

  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadError, setUploadError] = useState("");

  const [targetBullet, setTargetBullet] = useState(null);
  const [selectedText, setSelectedText] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectionPos, setSelectionPos] = useState(null);

  const fileInputRef = useRef(null);
  const resumePaperRef = useRef(null);
  const currentResume = resumes[currentResumeIndex];
  const [isSaving, setIsSaving] = useState(false);

  // Helper to force anything into a plain string
  const safeString = (val) => {
    if (val && typeof val === "object" && val.$$typeof) {
      console.warn("React element found in data:", val);
      return "";
    }

    if (val == null) return "";
    if (typeof val === "string") return val;
    if (typeof val === "number") return String(val);
    if (typeof val === "object") {
      if (val.$$typeof) return "";
      if (typeof val.text === "string") return val.text;
      return JSON.stringify(val);
    }
    return String(val);
  };

  const buildCleanData = (resume) => {
    if (!resume) return null;

    const rawHeader = resume.header || [];
    const cleanHeader = Array.isArray(rawHeader) ? rawHeader.map(safeString) : [safeString(rawHeader)];

    const cleanEducation = normalizeEducation(resume.education).map((edu) => ({
      institution: safeString(edu.institution),
      degree: safeString(edu.degree),
      year: safeString(edu.year),
    }));

    const cleanExperience = normalizeExperience(resume.experience).map((exp) => ({
      company: safeString(exp.company),
      title: safeString(exp.title),
      start_date: safeString(exp.start_date),
      end_date: safeString(exp.end_date),
      bullets: (exp.bullets || []).map(safeString),
    }));

    const cleanProjects = normalizeProjects(resume.projects).map((proj) => ({
      name: safeString(proj.name),
      description: safeString(proj.description),
      tech_stack: (proj.tech_stack || []).map(safeString),
      links: (proj.links || []).map(safeString),
    }));

    let cleanSkills = [];
    if (Array.isArray(resume.skills)) cleanSkills = resume.skills.map(safeString);
    else if (typeof resume.skills === "string") cleanSkills = resume.skills.split(",").map((s) => s.trim()).filter(Boolean);

    return {
      header: cleanHeader,
      summary: safeString(resume.summary),
      education: cleanEducation,
      experience: cleanExperience,
      projects: cleanProjects,
      skills: cleanSkills,
    };
  };

  const handleDownloadDOCX = async () => {
    if (!currentResume) return;
    const cleanData = buildCleanData(currentResume);
    if (!cleanData) return;

    await exportResumeToDocx(cleanData, safeString(currentResume.fileName) || "resume");
  };
  

  const splitIntoBullets = (text) => {
    const cleaned = String(text || "").replace(/\r/g, "").trim();
    if (!cleaned) return [];
    const lines = cleaned.split("\n");
    const bullets = [];
    let cur = "";
    const pushCur = () => { const v = cur.trim(); if (v) bullets.push(v); cur = ""; };
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) { pushCur(); continue; }
      const isBulletStart = /^[-•*]\s+/.test(l);
      if (isBulletStart) { pushCur(); cur = l.replace(/^[-•*]\s+/, ""); }
      else { cur = cur ? `${cur} ${l}` : l; }
    }
    pushCur();
    return bullets.map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean);
  };

  const fetchResumeVersion = async (firebaseUser, versionId) => {
    if (!firebaseUser || !versionId) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch(`${BACKEND_URL}/resume_versions/${versionId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setResumes((prev) =>
        prev.map((r) =>
          r.versionId === versionId
            ? { ...r, ...data, fileName: data.file_name || r.fileName, parsed: true, versionHistory: [] }
            : r
        )
      );
    } catch (err) {
      console.error("Error fetching version:", err);
    }
  };

  const loadStoredResumes = async (firebaseUser) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch(`${BACKEND_URL}/resumes`, {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const items = data.items || [];
      const mapped = items.map((item) => ({
        resumeId: item.resume_id,
        versionId: item.version_id,
        fileName: item.title,
        uploadedAt: item.created_date,
        parsed: false,
      }));
      setResumes(mapped);
      if (mapped.length > 0) {
        setCurrentResumeIndex(0);
        await fetchResumeVersion(firebaseUser, mapped[0].versionId);
      }
    } catch (err) {
      console.error("Error loading stored resumes:", err);
    }
  };

  const getBulletsFromSelection = (range) => {
    if (!resumePaperRef.current || !range) return [];
    const nodes = resumePaperRef.current.querySelectorAll("li[data-section][data-item][data-bullet]");
    const selectionRects = Array.from(range.getClientRects());
    const rectsOverlap = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

    const metas = [];
    nodes.forEach((el) => {
      const elRect = el.getBoundingClientRect();
      if (selectionRects.length === 0) {
        const r = range.getBoundingClientRect();
        if (rectsOverlap(r, elRect)) {
          metas.push({
            section: el.dataset.section,
            itemIndex: Number(el.dataset.item),
            bulletIndex: Number(el.dataset.bullet),
          });
        }
        return;
      }
      const hit = selectionRects.some((sr) => rectsOverlap(sr, elRect));
      if (hit) {
        metas.push({
          section: el.dataset.section,
          itemIndex: Number(el.dataset.item),
          bulletIndex: Number(el.dataset.bullet),
        });
      }
    });

    const seen = new Set();
    return metas.filter((m) => {
      const k = `${m.section}-${m.itemIndex}-${m.bulletIndex}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    setCurrentUser(user || null);

    if (user) {
      loadStoredResumes(user);
      user.getIdToken().then((token) => {
        fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((profile) => setSubscriptionTier(profile.tier || "free"))
          .catch(() => setSubscriptionTier("free"));
      });
    } else {
      setSubscriptionTier("free");
      setResumes([]);
      setCurrentResumeIndex(0);
    }
  });

  return () => unsubscribe();
}, []);

  // ✅ disable selection tooltip behavior on interview route
  useEffect(() => {
    if (isInterviewRoute) {
      setSelectionPos(null);
      return;
    }

    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) { setSelectionPos(null); return; }
      const text = selection.toString().trim();
      if (text.length > 5) {
        const range = selection.getRangeAt(0);
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') { setSelectionPos(null); return; }
        if (resumePaperRef.current && !resumePaperRef.current.contains(range.commonAncestorContainer)) { setSelectionPos(null); return; }
        const bulletMetas = getBulletsFromSelection(range);
        setTargetBullet(bulletMetas.length > 0 ? { type: "multi", bullets: bulletMetas } : null);
        const rect = range.getBoundingClientRect();
        setSelectionPos({ x: rect.left + rect.width / 2 + window.scrollX, y: rect.top - 40 + window.scrollY });
        setSelectedText(text);
      } else {
        setSelectionPos(null);
      }
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [isInterviewRoute]);

  const handleClearHistory = () => {
    triggerConfirm(
      "Clear History",
      "Are you sure you want to clear all version history for this resume? This cannot be undone.",
      () => {
        setResumes(prev => {
          const newResumes = [...prev];
          newResumes[currentResumeIndex] = { ...newResumes[currentResumeIndex], versionHistory: [] };
          return newResumes;
        });
      },
      true
    );
  };

const handleSaveToDatabase = async () => {
    console.log(currentResume);
    if (!currentResume || !currentResume.resumeId) { triggerAlert("No Resume", "No resume selected to save.", "error"); return; }
    if (!currentUser) { triggerAlert("Login Required", "You must be logged in to save.", "error"); return; }
    setIsSaving(true);

    try {
      const idToken = await currentUser.getIdToken();
      const cleanEdu = normalizeEducation(currentResume.education);
      const cleanExp = normalizeExperience(currentResume.experience);
      const cleanProj = normalizeProjects(currentResume.projects);

      const payload = {
        header: (currentResume.header || []).map(h => String(h || "")),
        summary: String(currentResume.summary || ""),
        education: cleanEdu.map(e => ({ institution: String(e.institution || ""), degree: String(e.degree || ""), year: String(e.year || "") })),
        experience: cleanExp.map(e => ({
          company: String(e.company || ""),
          title: String(e.title || ""),
          start_date: e.start_date ? String(e.start_date) : null,
          end_date: e.end_date ? String(e.end_date) : null,
          bullets: Array.isArray(e.bullets) ? e.bullets.map(String) : []
        })),
        projects: cleanProj.map(p => ({
          name: String(p.name || ""),
          description: String(p.description || ""),
          tech_stack: Array.isArray(p.tech_stack) ? p.tech_stack.map(String) : [],
          links: Array.isArray(p.links) ? p.links.map(String) : []
        })),
        skills: (currentResume.skills || []).map(String),
        certifications: (currentResume.certifications || []).map(c => ({
          name: String(c.name || ""),
          issuer: String(c.issuer || ""),
          issue_date: c.issue_date ? String(c.issue_date) : null,
          expiry_date: c.expiry_date ? String(c.expiry_date) : null
        })),
        // --- NEW: Pass the current JD Panel state to backend ---
        job_description_text: jdText,
        job_description_keywords: jdKeywords
      };

      const response = await fetch(`${BACKEND_URL}/resumes/${currentResume.resumeId}/save`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to save");
      }

      const saved = await response.json();

      // Update local state to reflect that this version now has this JD saved
      handleResumeUpdate({
        ...currentResume,
        versionId: saved.version_id || currentResume.versionId,
        job_description_text: jdText,
        job_description_keywords: jdKeywords
      });

      triggerAlert("Success", "Resume and Job Target saved successfully!", "success");
    } catch (err) {
      console.error(err);
      triggerAlert("Save Failed", err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };
useEffect(() => {
    if (currentResume) {
      // If the loaded resume has saved JD data, extract it into the panel
      if (currentResume.job_description_text !== undefined) {
        setJdText(currentResume.job_description_text || "");
      }
      
      if (currentResume.job_description_keywords !== undefined) {
        setJdKeywords(currentResume.job_description_keywords || []);
      }
    }
  }, [currentResumeIndex, resumes]);

  const handleRestoreVersion = (versionData, idx) => {
    triggerConfirm("Restore Version", "Restore this version? Current unsaved work will be saved as a backup.", () => {
      setResumes((prev) => {
        const newResumes = [...prev];
        const currentRes = newResumes[currentResumeIndex];

        const backupVersion = {
          timestamp: new Date().toISOString(),
          label: `Safety Backup`,
          data: {
            header: currentRes.header,
            summary: currentRes.summary,
            education: currentRes.education,
            experience: currentRes.experience,
            projects: currentRes.projects,
            skills: currentRes.skills,
          }
        };

        const updatedHistory = [backupVersion, ...(currentRes.versionHistory || [])];
        newResumes[currentResumeIndex] = { ...currentRes, ...versionData.data, versionHistory: updatedHistory };
        return newResumes;
      });
      setIsVersionModalOpen(false);
    });
  };

  const getChangeLabel = (oldData, newData) => {
    if (JSON.stringify(oldData.header) !== JSON.stringify(newData.header)) return "Edited Header";
    if (oldData.summary !== newData.summary) return "Edited Summary";
    if (JSON.stringify(oldData.education) !== JSON.stringify(newData.education)) return "Edited Education";
    if (JSON.stringify(oldData.experience) !== JSON.stringify(newData.experience)) {
      if (oldData.experience?.length !== newData.experience?.length) return "Updated Experience Items";
      return "Edited Experience";
    }
    if (JSON.stringify(oldData.projects) !== JSON.stringify(newData.projects)) {
      if (oldData.projects?.length !== newData.projects?.length) return "Updated Projects List";
      return "Edited Projects";
    }
    if (JSON.stringify(oldData.skills) !== JSON.stringify(newData.skills)) return "Edited Skills";
    return "Content Update";
  };

  const handleResumeUpdate = (updatedData) => {
    setResumes((prev) => {
      const newResumes = [...prev];
      const oldVersion = newResumes[currentResumeIndex];
      const label = getChangeLabel(oldVersion, updatedData);

      const historyEntry = {
        timestamp: new Date().toISOString(),
        data: {
          header: oldVersion.header,
          summary: oldVersion.summary,
          experience: oldVersion.experience,
          education: oldVersion.education,
          projects: oldVersion.projects,
          skills: oldVersion.skills,
        },
        label: label
      };

      newResumes[currentResumeIndex] = { ...updatedData, versionHistory: [historyEntry, ...(oldVersion.versionHistory || [])] };
      return newResumes;
    });
  };

  // --- JOB DESCRIPTION ANALYSIS (New Feature) ---
  const handleAnalyzeJob = async () => {
    if (!jdText.trim()) return;
    if (!currentUser) {
      triggerAlert("Login Required", "You must be logged in to analyze a job description.", "error");
      return;
    }
    setIsAnalyzingJd(true);
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${BACKEND_URL}/analyze_jd`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ jd_text: jdText, provider: "groq"}),
      });
      if (!response.ok) throw new Error("Failed to analyze job description");
      const data = await response.json();
      setJdKeywords(data.keywords || []);
    } catch (err) {
      console.error(err);
      triggerAlert("Analysis Failed", err.message, "error");
    } finally {
      setIsAnalyzingJd(false);
    }
  };

  const runOptimization = async (text, bulletMeta) => {
  if (!text) return;

  if (!currentUser) {
    setOptimizedText("Error: You must be logged in to optimize text.");
    setIsOptimizationModalOpen(true);
    return;
  }

  setSelectedText(text);
  setTargetBullet(bulletMeta);
  setIsOptimizationModalOpen(true);
  setIsOptimizing(true);
  setSelectionPos(null);

  try {
    const idToken = await currentUser.getIdToken();

    const response = await fetch(`${BACKEND_URL}/optimize_text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        selected_text: text,
        provider: "groq",           // backend can ignore this if unused
        target_keywords: jdKeywords,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Optimization failed");
    }

    const data = await response.json();
    setOptimizedText(data.optimized_text);
  } catch (err) {
    setOptimizedText("Error: " + err.message);
  } finally {
    setIsOptimizing(false);
  }
};


  const handleOptimizeBullet = (section, itemIndex, bulletIndex, text) => {
    runOptimization(text, { section, itemIndex, bulletIndex });
  };

  const setProjectDescription = (proj, newDescription) => {
    if (proj?.name && typeof proj.name === "object") {
      return { ...proj, name: { ...proj.name, description: newDescription } };
    }
    return { ...proj, description: newDescription };
  };

  const fitToCount = (arr, count) => {
    const out = [...arr];
    if (count <= 0) return [];
    if (out.length === 0) out.push("");
    if (out.length > count) return out.slice(0, count);
    while (out.length < count) out.push(out[out.length - 1]);
    return out;
  };

  const getProjectDescription = (proj) => {
    if (proj?.name && typeof proj.name === "object") return proj.name.description || "";
    return proj?.description || "";
  };

  const applyOptimizedText = () => {
    if (!targetBullet) { setIsOptimizationModalOpen(false); return; }
    const current = resumes[currentResumeIndex];
    let updated = { ...current };

    // -------- MULTI BULLET REPLACE --------
    if (targetBullet.type === "multi") {
      const metas = (targetBullet.bullets || []).slice();
      const candidates = splitIntoBullets(optimizedText);

      const groups = new Map();
      for (const m of metas) {
        const key = `${m.section}:${m.itemIndex}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(m);
      }

      let updated = { ...resumes[currentResumeIndex] };

      groups.forEach((groupMetas) => {
        groupMetas.sort((a, b) => a.bulletIndex - b.bulletIndex);
        const section = groupMetas[0].section;
        const itemIndex = groupMetas[0].itemIndex;
        const start = groupMetas[0].bulletIndex;
        const end = groupMetas[groupMetas.length - 1].bulletIndex;
        const count = end - start + 1;

        const insertBulletsRaw = candidates.length > 0 ? candidates : [optimizedText.replace(/\s+/g, " ").trim()];
        const insertBullets = fitToCount(insertBulletsRaw, count);

        if (section === "experience") {
          const newExp = [...(updated.experience || [])];
          if (!newExp[itemIndex] || !Array.isArray(newExp[itemIndex].bullets)) return;
          const newBullets = [...newExp[itemIndex].bullets];
          newBullets.splice(start, count, ...insertBullets);
          newExp[itemIndex] = { ...newExp[itemIndex], bullets: newBullets };
          updated.experience = newExp;
        }

        if (section === "projects") {
          const newProjs = [...(updated.projects || [])];
          let projectToUpdate = { ...newProjs[itemIndex] };
          let beforeDesc = "";

          if (projectToUpdate.description) beforeDesc = projectToUpdate.description;
          else if (projectToUpdate.name && typeof projectToUpdate.name === 'object' && projectToUpdate.name.description) beforeDesc = projectToUpdate.name.description;
          else if (typeof projectToUpdate.name === 'string' && projectToUpdate.name.includes("description='")) {
            const match = projectToUpdate.name.match(/description='([\s\S]*?)'\s*(tech_stack=|\s*$)/);
            if (match && match[1]) beforeDesc = match[1].replace(/\\n/g, "\n");
          }

          const descLines = beforeDesc.split("\n").map((l) => l.trim()).filter(Boolean);
          descLines.splice(start, count, ...insertBullets);
          const afterDesc = descLines.join("\n");
          newProjs[itemIndex] = setProjectDescription(projectToUpdate, afterDesc);
          updated.projects = newProjs;
        }
      });

      handleResumeUpdate(updated);
      setIsOptimizationModalOpen(false);
      setTargetBullet(null);
      return;
    }

    // -------- SINGLE BULLET REPLACE --------
    const { section, itemIndex, bulletIndex } = targetBullet;

    if (section === "experience") {
      const newExp = [...(current.experience || [])];
      if (newExp[itemIndex] && newExp[itemIndex].bullets) {
        const newBullets = [...newExp[itemIndex].bullets];
        newBullets[bulletIndex] = optimizedText;
        newExp[itemIndex] = { ...newExp[itemIndex], bullets: newBullets };
        updated.experience = newExp;
      }
    } else if (section === "projects") {
      const newProjs = [...(current.projects || [])];
      if (newProjs[itemIndex]) {
        const beforeDesc = getProjectDescription(newProjs[itemIndex]);
        const descLines = beforeDesc.split("\n").map((l) => l.trim()).filter(Boolean);
        while (descLines.length <= bulletIndex) descLines.push("");
        descLines[bulletIndex] = optimizedText;
        const afterDesc = descLines.join("\n");
        newProjs[itemIndex] = setProjectDescription(newProjs[itemIndex], afterDesc);
        updated.projects = newProjs;
      }
    }

    handleResumeUpdate(updated);
    setIsOptimizationModalOpen(false);
    setTargetBullet(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!currentUser) { setUploadStatus("error"); setUploadError("You must be logged in to upload a resume."); return; }
    setUploadStatus("uploading");
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${BACKEND_URL}/parse_resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to parse resume");

      const data = await response.json();
      setResumes((prev) => [
        ...prev,
        {
          ...data,
          resumeId: data.resume_id,
          fileName: data.file_name || file.name,
          uploadedAt: new Date().toISOString(),
          parsed: true,
          versionHistory: [],
        },
      ]);

      setCurrentResumeIndex(resumes.length);
      setUploadStatus("success");
      setTimeout(() => { setIsUploadModalOpen(false); setUploadStatus("idle"); }, 800);
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err.message);
    }
  };

  const handleDeleteResume = async (res, idx) => {
    if (!currentUser || !res.resumeId) return;
    triggerConfirm("Delete Resume", "Are you sure you want to delete this resume? This cannot be undone.", async () => {
      try {
        const idToken = await currentUser.getIdToken();
        const resp = await fetch(`${BACKEND_URL}/resumes/${res.resumeId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` }
        });
        if (!resp.ok) return;

        setResumes((prev) => {
          const updated = prev.filter((_, i) => i !== idx);
          if (updated.length === 0) setCurrentResumeIndex(0);
          else if (idx <= currentResumeIndex && currentResumeIndex > 0) {
            setCurrentResumeIndex((p) => Math.min(p - 1, updated.length - 1));
          }
          return updated;
        });
      } catch (err) {
        console.error(err);
      }
    }, true);
  };

  return (
    <div className="app-container">
      {selectionPos && !isInterviewRoute && (
        <div
          className="selection-tooltip"
          style={{ top: selectionPos.y, left: selectionPos.x }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); runOptimization(selectedText, targetBullet); }}
        >
          <Sparkles size={14} className="text-yellow-400" /> <span>Improve Selection</span>
        </div>
      )}

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="main-content">
        <header className="topbar">
          <button onClick={() => setIsSidebarOpen(true)} className="mobile-menu-btn"><Menu size={24} /></button>

          <div className="controls-group">
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

          {/* keep this as-is (topbar right) */}
          <div
            className="user-menu"
            onClick={() => currentUser ? navigate("/account") : navigate("/login")}
            style={{ cursor: "pointer" }}
          >
            <span>{currentUser ? "My Account" : "Log in"}</span>
            <User size={24} />
          </div>
        </header>

        <div className="scroll-area">
          <div className="container">
            <div className="page-header">
              <h1 className="page-title">
                {isInterviewRoute ? "Interview Practice" : (currentResume ? currentResume.fileName : 'Welcome back, "User"')}
              </h1>

              <div className="controls-row">
                <div className="btn-group">
                  {!isInterviewRoute && (
                    <>
                      <button onClick={() => setIsUploadModalOpen(true)} className="btn btn-primary">Upload Resume</button>

                      <button
                        onClick={handleSaveToDatabase}
                        disabled={isSaving}
                        className="btn btn-primary"
                        style={{ backgroundColor: isSaving ? '#93c5fd' : '#2563eb' }}
                      >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        <span>{isSaving ? "Saving..." : "Save"}</span>
                      </button>

                      <button
                        onClick={handleDownloadDOCX}
                        disabled={!currentResume}
                        className="btn btn-primary"
                        style={{ backgroundColor: "#7c3aed" }}
                      >
                        Download DOCX
                      </button>

                      <button
                        onClick={() => setIsJdPanelOpen(!isJdPanelOpen)}
                        className={`btn btn-secondary ${isJdPanelOpen ? "bg-emerald-50 border-emerald-200 text-emerald-700" : ""}`}
                      >
                        <Target size={18} /><span>Job Description</span>
                      </button>

                      <button onClick={() => setIsVersionModalOpen(true)} className="btn btn-secondary">View Versions</button>

                      <button
                        onClick={() => setShowMyResumesDrawer(!showMyResumesDrawer)}
                        className={`btn btn-secondary ${showMyResumesDrawer ? "bg-gray-200" : ""}`}
                      >
                        <FolderOpen size={18} /><span>My Resumes</span>
                      </button>
                    </>
                  )}
                </div>

                {!isInterviewRoute && (
                  <div className="arrow-controls">
                    <button
                      onClick={() => currentResumeIndex > 0 && setCurrentResumeIndex(p => p - 1)}
                      disabled={currentResumeIndex === 0}
                      className="arrow-btn"
                    >
                      <ChevronLeft size={32} />
                    </button>
                    <button
                      onClick={() => currentResumeIndex < resumes.length - 1 && setCurrentResumeIndex(p => p + 1)}
                      disabled={!resumes.length || currentResumeIndex === resumes.length - 1}
                      className="arrow-btn"
                    >
                      <ChevronRight size={32} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="resume-wrapper">
              {isInterviewRoute ? (
                <InterviewPage />
              ) : (
                <>
                  {showMyResumesDrawer && (
                    <div className="drawer-container">
                      <div className="drawer-header">
                        <h3 style={{ fontWeight: 600, fontSize: "0.95rem" }}>My Resumes</h3>
                        <button
                          className="add-resume-btn"
                          style={{ background: "none", border: "none", cursor: "pointer" }}
                          onClick={() => setIsUploadModalOpen(true)}
                        >
                          <Plus size={20} />
                        </button>
                      </div>

                      <div className="drawer-list">
                        {resumes.map((res, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setCurrentResumeIndex(idx);
                              if (res.versionId && !res.parsed && currentUser)
                                fetchResumeVersion(currentUser, res.versionId);
                            }}
                            className={`drawer-item ${currentResumeIndex === idx ? "active" : ""}`}
                            style={{ position: "relative" }}
                          >
                            <div className="drawer-preview" />
                            <p
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                margin: 0,
                                textAlign: "center",
                                wordBreak: "break-word",
                              }}
                            >
                              {res.fileName}
                            </p>

                            <button
                              type="button"
                              style={{
                                position: "absolute",
                                top: 4,
                                right: 4,
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteResume(res, idx);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}

                        {resumes.length === 0 && (
                          <p style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", marginTop: "1rem" }}>
                            No resumes yet.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={`resume-paper-container ${showMyResumesDrawer ? "shifted" : ""}`}>
                    <ResumePaper
                      ref={resumePaperRef}
                      data={currentResume}
                      onOptimizeBullet={handleOptimizeBullet}
                      onUploadReq={() => setIsUploadModalOpen(true)}
                      onUpdate={handleResumeUpdate}
                    />
                  </div>

                  {isJdPanelOpen && (
                    <div
                      className="drawer-container"
                      style={{ marginLeft: "1rem", width: "300px", borderLeft: "1px solid #e5e7eb", borderRight: "none" }}
                    >
                      <div className="drawer-header" style={{ justifyContent: "space-between" }}>
                        <h3 style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Briefcase size={16} /> Target Job
                        </h3>
                        <button onClick={() => setIsJdPanelOpen(false)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                          <X size={16} />
                        </button>
                      </div>

                      <div style={{ padding: "1rem", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        
                        {/* NEW LOAD SECTION */}
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", marginBottom: "0.25rem", display: "flex", justifyContent: "space-between" }}>
                            Load Saved Job 
                            <button 
                              onClick={refreshSavedJds} 
                              style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.7rem" }}
                            >
                              {isLoadingSavedJds ? "..." : "Refresh"}
                            </button>
                          </label>
                          <select 
                            className="provider-select" 
                            style={{ width: "100%", paddingLeft: "10px" }}
                            value={selectedJdId}
                            onChange={(e) => handleLoadJd(e.target.value)}
                          >
                            <option value="">— Select a Saved JD —</option>
                            {savedJds.map(jd => (
                              <option key={jd.id} value={jd.id}>{jd.name}</option>
                            ))}
                          </select>
                        </div>

                        <hr style={{ border: "0", borderTop: "1px solid #f3f4f6" }} />

                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", marginBottom: "0.25rem", display: "block" }}>
                            Job Description
                          </label>
                          <textarea
                            className="editable-input multiline"
                            rows={8}
                            placeholder="Paste Job Description here..."
                            value={jdText}
                            onChange={(e) => {
                              setJdText(e.target.value);
                              if (selectedJdId) setSelectedJdId(""); // Deselect if user starts typing
                            }}
                            style={{ width: "100%", fontSize: "0.8rem", padding: "0.5rem" }}
                          />
                        </div>
                        
                        {/* Buttons row */}
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            className="btn btn-primary"
                            onClick={handleAnalyzeJob}
                            disabled={isAnalyzingJd || !jdText.trim()}
                            style={{ flex: 1, justifyContent: "center" }}
                          >
                            {isAnalyzingJd ? <Loader2 className="animate-spin" size={16} /> : <Target size={16} />}
                            {isAnalyzingJd ? "Analyzing..." : "Keywords"}
                          </button>

                          <button
                            className="btn btn-secondary"
                            onClick={() => setShowJdSaveModal(true)}
                            disabled={jdText.trim().length < 10}
                            style={{ flex: 1, justifyContent: "center" }}
                          >
                            <Save size={16} /> Save
                          </button>
                        </div>
                        {jdKeywords.length > 0 && (
                          <div>
                            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", marginBottom: "0.5rem" }}>
                              Active Keywords
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                              {jdKeywords.map((kw, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    backgroundColor: "#d1fae5",
                                    color: "#065f46",
                                    border: "1px solid #a7f3d0",
                                  }}
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                            <p style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.5rem", fontStyle: "italic" }}>
                              These keywords will be automatically applied when you optimize bullets.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* --- Optimization Modal (Updated to show active keywords) --- */}
      {isOptimizationModalOpen && !isInterviewRoute && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: "85vh", display: "flex", flexDirection: "column", width: "600px", maxWidth: "95%" }}>
            <div style={{ flexShrink: 0, paddingBottom: "1rem" }}>
              <button onClick={() => setIsOptimizationModalOpen(false)} className="close-modal-btn"><X size={20} /></button>
              <h2 className="modal-title flex items-center gap-2">
                <Sparkles className="text-yellow-500" /> Optimize Content
              </h2>

              {jdKeywords.length > 0 && (
                <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "#059669", backgroundColor: "#ecfdf5", padding: "4px 8px", borderRadius: "4px", width: "fit-content" }}>
                  <Target size={12} />
                  <span>Tailoring with <b>{jdKeywords.length}</b> keywords from JD</span>
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", paddingRight: "5px", minHeight: 0 }}>
              {isOptimizing ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="animate-spin text-emerald-500 mb-4" size={40} />
                  <p className="text-gray-500">AI is rewriting your text...</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="comparison-box">
                    <div className="comparison-label">Original</div>
                    <div className="comparison-text original" style={{ whiteSpace: "pre-wrap" }}>{selectedText}</div>
                  </div>

                  <div className="flex justify-center">
                    <div className="bg-gray-100 p-1 rounded-full">
                      <ChevronRight className="rotate-90 text-gray-400" size={20} />
                    </div>
                  </div>

                  <div className="comparison-box" style={{ borderColor: "#34d399", backgroundColor: "#ecfdf5" }}>
                    <div className="comparison-label" style={{ color: "#059669" }}>Optimized</div>
                    <div className="comparison-text optimized" style={{ whiteSpace: "pre-wrap" }}>{optimizedText}</div>
                  </div>
                </div>
              )}
            </div>

            {!isOptimizing && (
              <div style={{ flexShrink: 0, paddingTop: "1rem" }}>
                <button
  onClick={() => {
    if (needsUpgrade) {
      setIsOptimizationModalOpen(false);
      navigate("/premium");
      return;
    }
    applyOptimizedText();
  }}
  className="modal-btn"
  style={{ backgroundColor: '#2563eb', color: 'white', width: '100%' }}
>
  {needsUpgrade ? "Upgrade Plan" : (targetBullet?.type === "multi" ? "Replace Selection" : "Replace Bullet")}
</button>

              </div>
            )}
          </div>
        </div>
      )}

      {isUploadModalOpen && !isInterviewRoute && (
        <div className="modal-overlay">
          <div className="modal">
            <button onClick={() => setIsUploadModalOpen(false)} className="close-modal-btn"><X size={20} /></button>
            <h2 className="modal-title">Upload Resume</h2>

            <div className={`upload-area ${uploadStatus}`} onClick={() => uploadStatus !== "uploading" && fileInputRef.current?.click()}>
              {uploadStatus === "uploading" ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="animate-spin text-emerald-500 mb-2" size={32} />
                  <span>Parsing...</span>
                </div>
              ) : uploadStatus === "error" ? (
                <>
                  <AlertCircle size={40} color="#ef4444" style={{ marginBottom: "0.5rem" }} />
                  <span className="upload-status-text" style={{ color: "#dc2626" }}>{uploadError}</span>
                </>
              ) : uploadStatus === "success" ? (
                <>
                  <CheckCircle size={40} color="#10b981" style={{ marginBottom: "0.5rem" }} />
                  <span className="upload-status-text" style={{ color: "#059669" }}>Upload Complete!</span>
                </>
              ) : (
                <>
                  <Upload size={40} color="#9ca3af" style={{ marginBottom: "0.75rem" }} />
                  <span style={{ fontWeight: 500, color: "#6b7280" }}>Click to browse</span>
                  <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>PDF Files Only</span>
                </>
              )}

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                style={{ display: "none" }}
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={uploadStatus === "uploading"}
              />
            </div>
          </div>
        </div>
      )}

      {isVersionModalOpen && !isInterviewRoute && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: "400px", textAlign: "left", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ flexShrink: 0 }}>
              <button onClick={() => setIsVersionModalOpen(false)} className="close-modal-btn"><X size={20} /></button>
              <h2 className="modal-title" style={{ marginBottom: "1rem" }}>Version History</h2>

              <div style={{ paddingBottom: "1rem", borderBottom: "1px solid #e5e7eb", marginBottom: "1rem" }}>
                <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>Current Document:</p>
                <p style={{ fontWeight: 600, margin: 0 }}>{currentResume?.fileName}</p>
              </div>
            </div>

            <div className="history-list" style={{ flex: 1, overflowY: "auto", minHeight: "200px" }}>
              {(!currentResume?.versionHistory || currentResume.versionHistory.length === 0) && (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "1rem" }}>
                  No edit history.<br />
                  <span style={{ fontSize: "0.8rem" }}>Edits are saved automatically.</span>
                </p>
              )}

              {currentResume?.versionHistory?.map((ver, idx) => (
                <div
                  key={idx}
                  className="history-item"
                  style={{ cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div className="history-icon">
                      {ver.label === "Safety Backup" ? <FileText size={20} color="#f59e0b" /> : <FileText size={20} />}
                    </div>
                    <div className="history-details">
                      <p className="history-title" style={{ fontWeight: ver.label === "Safety Backup" ? 600 : 500 }}>
                        {ver.label}
                      </p>
                      <p className="history-meta">
                        {new Date(ver.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestoreVersion(ver, idx)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb',
                      background: 'white',
                      cursor: 'pointer',
                      color: '#374151'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#34d399'; e.currentTarget.style.color = '#059669'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>

            {currentResume?.versionHistory?.length > 0 && (
              <div style={{ paddingTop: "1rem", borderTop: "1px solid #e5e7eb", marginTop: "1rem", textAlign: "center" }}>
                <button
                  onClick={handleClearHistory}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  Clear History
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal config={modalConfig} setConfig={setModalConfig} />
      {/* Save Job Description Modal */}
{showJdSaveModal && (
  <div className="modal-overlay">
    <div className="modal" style={{ width: "400px" }}>
      <button onClick={() => setShowJdSaveModal(false)} className="close-modal-btn">
        <X size={20} />
      </button>
      <h2 className="modal-title">Save Job Description</h2>
      <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "1rem" }}>
        Give this job description a name to find it later in Interview Practice.
      </p>

      <label className="label" style={{ display: "block", marginBottom: "0.5rem" }}>Name</label>
      <input
        className="api-key-input"
        style={{ width: "100%", marginBottom: "1.5rem", padding: "0.75rem" }}
        value={saveName}
        onChange={(e) => setSaveName(e.target.value)}
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
          disabled={isSavingJd || !saveName.trim()}
        >
          {isSavingJd ? <Loader2 className="animate-spin" size={16} /> : "Confirm Save"}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default App;
