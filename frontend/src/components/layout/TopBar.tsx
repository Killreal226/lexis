import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-store";
import { LogOut, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const navItems: { to: string; label: string; end?: boolean }[] = [
  { to: "/onboarding", label: "Onboarding" },
  { to: "/session/learning", label: "Learning" },
  { to: "/session/review", label: "Review" },
  { to: "/stats", label: "Stats" },
];

export function TopBar() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-lavender-300 to-peach-300 shadow-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Lexis
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-ink-900 text-white"
                      : "text-ink-600 hover:bg-ink-100",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/words/new")}
              className="btn-pastel-lavender"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Своё слово</span>
            </button>

            <div className="hidden md:flex items-center gap-2 pl-3 ml-1 border-l border-ink-200">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-mint-200 text-emerald-800 text-xs font-semibold">
                {user?.email.slice(0, 1).toUpperCase()}
              </div>
              <div className="text-sm leading-tight">
                <div className="font-medium text-ink-900 max-w-[160px] truncate">
                  {user?.email}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="ml-1 grid h-9 w-9 place-items-center rounded-full text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition"
                title="Выйти"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <nav className="md:hidden flex items-center gap-1 overflow-x-auto pb-3 -mx-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 bg-white border border-ink-200",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
