import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { ChallengePage } from "../pages/ChallengePage";
import { CommunityPage } from "../pages/CommunityPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LandingPage } from "../pages/LandingPage";
import { LessonPage } from "../pages/LessonPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { useAuth } from "../features/auth/AuthContext";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen w-full flex items-center justify-center font-black text-2xl">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen w-full flex items-center justify-center font-black text-2xl">Loading...</div>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Routes>
      {/* Standalone Route without AppLayout (No Navbar) */}
      <Route path="/" element={
        <PublicOnlyRoute>
          <LandingPage />
        </PublicOnlyRoute>
      } />

      {/* Authenticated Routes with Navbar Layout */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/lessons/:slug" element={<ProtectedRoute><LessonPage /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute><ChallengePage /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

