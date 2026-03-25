import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./Dashboard";
import DashboardResume from "./resumePage";
import DashboardCoverLetter from "./coverLetterPage";

import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import AccountPage from "./AccountPage";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";
import ChangePasswordPage from "./ChangePasswordPage";
import MaintenancePage from "./MaintenancePage";
import DeleteAccountPage from "./DeleteAccountPage";

import ProtectedRoute from "./ProtectedRoute";
import PremiumPage from "./PremiumPage";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected */}
        <Route
          path="/maintenance"
          element={
            <ProtectedRoute>
              <MaintenancePage />
            </ProtectedRoute>
          }
        />

        {/* IMPORTANT: both routes render the SAME shell (resumePage) */}
        <Route
          path="/dashboard/resume"
          element={
            <ProtectedRoute>
              <DashboardResume />
            </ProtectedRoute>
          }
        />

        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              <DashboardResume />
            </ProtectedRoute>
          }
        />

        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/delete-account"
          element={
            <ProtectedRoute>
              <DeleteAccountPage />
            </ProtectedRoute>
          }
        />
                <Route
          path="/dashboard/cover-letter"
          element={
            <ProtectedRoute>
              <DashboardCoverLetter />
            </ProtectedRoute>
          }
        />
         <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
        

        <Route path="*" element={<h1>404 Page Not Found</h1>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

