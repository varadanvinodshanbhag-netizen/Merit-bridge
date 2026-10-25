import { useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { initTheme } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import AppShell from "@/components/layout/AppShell";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"));
const StudentsPage = lazy(() => import("@/pages/students/StudentsPage"));
const CompaniesPage = lazy(() => import("@/pages/companies/CompaniesPage"));
const DrivesPage = lazy(() => import("@/pages/drives/DrivesPage"));
const InterviewsPage = lazy(() => import("@/pages/interviews/InterviewsPage"));
const AnalyticsPage = lazy(() => import("@/pages/analytics/AnalyticsPage"));
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage"));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));

function PageLoadingFallback() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)]">
        <div className="w-4 h-4 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Login Page is primary entry gate */}
        <Route path="/login" element={<LoginPage />} />

        {/* Authenticated Application Shell */}
        <Route
          element={
            <PrivateRoute>
              <AppShell />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/students/*" element={<StudentsPage />} />
          <Route path="/companies/*" element={<CompaniesPage />} />
          <Route path="/drives/*" element={<DrivesPage />} />
          <Route path="/interviews" element={<InterviewsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Root and fallback routes navigate to /login first */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
