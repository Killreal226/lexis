import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/lib/auth-store";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import OnboardingPage from "@/pages/OnboardingPage";
import DrillPage from "@/pages/DrillPage";
import SessionPage from "@/pages/SessionPage";
import NewWordPage from "@/pages/NewWordPage";
import NotFoundPage from "@/pages/NotFoundPage";
import StatsPage from "@/pages/StatsPage";

export default function App() {
  const init = useAuth((s) => s.init);
  const status = useAuth((s) => s.status);

  useEffect(() => {
    void init();
  }, [init]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="min-h-full app-shell-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-ink-500">
          <span className="h-2 w-2 rounded-full bg-lavender-400 animate-pulse" />
          <span className="text-sm">Загружаем сессию…</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/drill" element={<DrillPage />} />
        <Route path="/session/learning" element={<SessionPage mode="learning" />} />
        <Route path="/session/review" element={<SessionPage mode="review" />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/words/new" element={<NewWordPage />} />
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
