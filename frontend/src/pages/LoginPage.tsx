import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-store";
import { ApiError } from "@/lib/api";
import { ArrowRight } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { AuthShell, AuthField } from "@/components/auth/AuthShell";

export default function LoginPage() {
  const status = useAuth((s) => s.status);
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated") {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не удалось войти. Попробуйте ещё раз.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="С возвращением"
      subtitle="Войдите, чтобы продолжить занятия."
      onSubmit={onSubmit}
    >
      <div className="space-y-4">
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <AuthField
          label="Пароль"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-rose2-200 bg-rose2-100/70 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary w-full !py-3"
        disabled={submitting}
      >
        {submitting ? (
          <Spinner className="border-white/40 border-t-white" />
        ) : null}
        <span>{submitting ? "Входим…" : "Войти"}</span>
        {!submitting && <ArrowRight className="h-4 w-4" />}
      </button>

      <p className="text-center text-sm text-ink-500">
        Нет аккаунта?{" "}
        <Link
          to="/register"
          className="font-medium text-lavender-600 hover:text-lavender-700 underline-offset-4 hover:underline"
        >
          Зарегистрироваться
        </Link>
      </p>
    </AuthShell>
  );
}
