import type { FormEvent, ReactNode } from "react";
import { Sparkles } from "lucide-react";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  onSubmit,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-full auth-bg flex items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-5xl grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div className="hidden lg:block px-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur border border-white/80 px-3 py-1.5 text-xs font-medium text-ink-700 shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-lavender-500" />
            <span>Учим английский по-умному</span>
          </div>
          <h1 className="mt-6 font-display text-5xl xl:text-6xl font-semibold tracking-tight leading-[1.05] text-ink-900">
            Слова, которые
            <br />
            <span className="bg-gradient-to-r from-lavender-500 via-rose2-400 to-peach-400 bg-clip-text text-transparent">
              остаются с тобой.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-ink-600 text-[17px] leading-relaxed">
            Интервальные повторения, два направления и аккуратный онбординг,
            чтобы не зубрить очевидное. Минимум суеты — максимум фокуса.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3 max-w-md">
            <Pill bg="bg-lavender-100" dot="bg-lavender-400">
              Learning
            </Pill>
            <Pill bg="bg-mint-100" dot="bg-mint-400">
              Review
            </Pill>
            <Pill bg="bg-peach-100" dot="bg-peach-400">
              Свои слова
            </Pill>
          </div>
        </div>

        <div className="glass-card p-8 sm:p-10 animate-scale-in">
          <div className="lg:hidden mb-6 inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-lavender-300 to-peach-300 shadow-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Lexis
            </span>
          </div>

          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>
          )}

          <form onSubmit={onSubmit} className="mt-7 space-y-5">
            {children}
          </form>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  hint?: string;
};

export function AuthField({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  minLength,
  hint,
}: FieldProps) {
  return (
    <label className="block">
      <span className="label block mb-2">{label}</span>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
      />
      {hint && (
        <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>
      )}
    </label>
  );
}

function Pill({
  children,
  bg,
  dot,
}: {
  children: ReactNode;
  bg: string;
  dot: string;
}) {
  return (
    <div
      className={`rounded-2xl ${bg} border border-white/70 backdrop-blur px-3.5 py-2.5 text-sm font-medium text-ink-700 flex items-center gap-2`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </div>
  );
}
