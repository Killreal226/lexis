import { Link, Navigate, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-store";
import { ApiError } from "@/lib/api";
import { ArrowRight } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { AuthShell, AuthField } from "@/components/auth/AuthShell";

export default function RegisterPage() {
  const status = useAuth((s) => s.status);
  const register = useAuth((s) => s.register);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated") return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Пароли не совпадают.");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов.");
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не удалось создать аккаунт. Попробуйте ещё раз.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Создать аккаунт"
      subtitle="Минута на регистрацию — и можно учить."
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
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={setPassword}
          placeholder="минимум 6 символов"
        />
        <AuthField
          label="Повторите пароль"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={setConfirm}
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
        <span>{submitting ? "Создаём…" : "Зарегистрироваться"}</span>
        {!submitting && <ArrowRight className="h-4 w-4" />}
      </button>

      <p className="text-center text-sm text-ink-500">
        Уже есть аккаунт?{" "}
        <Link
          to="/login"
          className="font-medium text-lavender-600 hover:text-lavender-700 underline-offset-4 hover:underline"
        >
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}
