import React from "react";
import { useNavigate } from "react-router-dom";
import maintenanceImg from "./Maintenance.webp";

const MaintenancePage = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffffff",
        flexDirection: "column",
        textAlign: "center",
      }}
    >
      <img
        src={maintenanceImg}
        alt="Website under maintenance"
        style={{ maxWidth: "320px", marginBottom: "1.5rem" }}
      />
      <p style={{ fontSize: "1rem", color: "#333" }}>
        This section is currently under maintenance.
      </p>
      <p style={{ fontSize: "0.9rem", color: "#444", marginBottom: "1.5rem" }}>
        Please come back soon.
      </p>

      {}
      <button
        onClick={() => navigate("/dashboard/resume")}
        style={{
          padding: "0.6rem 1.4rem",
          borderRadius: "9999px",
          border: "none",
          background: "#111827",
          color: "#f9fafb",
          fontSize: "0.9rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        ← Back to dashboard
      </button>
    </div>
  );
};

export default MaintenancePage;
