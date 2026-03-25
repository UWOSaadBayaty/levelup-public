import React from "react";
import { useNavigate } from "react-router-dom";
import { X, FileText, FileCheck } from "lucide-react";
import logo from "./logo.png";

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen, activeTab, setActiveTab }) => {
  const navigate = useNavigate();

  const handleNavClick = (item) => {
    setActiveTab(item);

    if (item === "Resumes") {
      navigate("/dashboard/resume");
    } else if (item === "Cover Letter") {
      navigate("/dashboard/cover-letter");
    } else if (item === "Interview Practice") {
      navigate("/interview");
    }

    setIsSidebarOpen(false);
  };

  return (
    <div className={`sidebar ${isSidebarOpen ? "open" : "closed"}`}>
      <div className="sidebar-header">
        <div onClick={() => navigate("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
          <img src={logo} alt="LevelUp logo" className="logo-icon" />
        </div>
        <button onClick={() => setIsSidebarOpen(false)} className="close-sidebar-btn">
          <X size={24} />
        </button>
      </div>

      <nav className="nav-menu">
        {["Resumes", "Cover Letter", "Interview Practice"].map((item) => (
          <button
            key={item}
            onClick={() => handleNavClick(item)}
            className={`nav-item ${activeTab === item ? "active" : ""}`}
          >
            {item === "Resumes" && <FileText size={18} />}
            {item === "Cover Letter" && <FileCheck size={18} />}
            {item === "Interview Practice" && <FileText size={18} />}
            <div className="nav-icon-spacer" />
            {item}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
