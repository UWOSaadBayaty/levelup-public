
import React from "react";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import "./ConfirmModal.css";

const ConfirmModal = ({ config, setConfig }) => {
  if (!config.isOpen) return null;

  const handleClose = () => {
    setConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    if (config.onConfirm) {
      config.onConfirm();
    }
    handleClose();
  };

  let Icon = AlertCircle;
  let iconColor = "#2563eb";
  let iconBg = "#eff6ff"; 

  if (config.isDanger) {
    Icon = AlertTriangle;
    iconColor = "#dc2626";
    iconBg = "#fee2e2";
  } else if (config.type === "alert") {
    Icon = CheckCircle;
    iconColor = "#059669";
    iconBg = "#ecfdf5";
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon-wrapper" style={{ backgroundColor: iconBg }}>
            <Icon size={24} color={iconColor} />
          </div>
          <h3 className="modal-title-text">{config.title}</h3>
        </div>

        <div className="modal-body">{config.message}</div>

        <div className="modal-actions">
          {}
          {config.type === "confirm" && (
            <button className="modal-btn modal-btn-cancel" onClick={handleClose}>
              Cancel
            </button>
          )}

          <button
            className={`modal-btn ${
              config.isDanger ? "modal-btn-danger" : "modal-btn-confirm"
            }`}
            onClick={handleConfirm}
          >
            {config.type === "confirm"
              ? config.isDanger
                ? "Confirm"
                : "Yes"
              : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;