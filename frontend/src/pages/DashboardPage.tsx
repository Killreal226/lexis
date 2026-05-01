import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Layers,
  RefreshCcw,
  Sprout,
  Sparkles,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";

const modes = [
  {
    to: "/onboarding",
    eyebrow: "Onboarding",
    title: "Учить новые слова",
    description:
      "Перебери пачку: незнакомое — в корзину на зубрёжку, знакомое — отметь, насколько оно тебе знакомо.",
    icon: Sprout,
    accent: "lavender",
    bgClass:
      "from-lavender-100 to-lavender-200/60 border-lavender-200/80 text-lavender-600",
  },
  {
    to: "/session/learning",
    eyebrow: "Learning · level 0–9",
    title: "Повторять learning",
    description:
      "Зубрим свежие слова: «знаю» — двигает уровень вперёд, «не знаю» — оставляет на месте.",
    icon: Layers,
    accent: "mint",
    bgClass:
      "from-mint-100 to-mint-200/60 border-mint-200/80 text-emerald-700",
  },
  {
    to: "/session/review",
    eyebrow: "Review · level 10+",
    title: "Повторять всё",
    description:
      "Наш алгоритм сам будет чаще возвращать слова, которые ещё не сели в память, и не крутить лишний раз то, что ты уже держишь уверенно.",
    icon: RefreshCcw,
    accent: "peach",
    bgClass:
      "from-peach-100 to-peach-200/60 border-peach-200/80 text-orange-700",
  },
  {
    to: "/stats",
    eyebrow: "Статистика",
    title: "Графики и цифры",
    description:
      "Сколько слов в learning, сколько в review по «плохо знаю», «хорошо знаю», «превосходно» — отдельно по EN→RU и RU→EN.",
    icon: BarChart3,
    accent: "sky",
    bgClass:
      "from-sky2-100 to-sky2-200/60 border-sky2-200/80 text-sky-700",
  },
] as const;

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const greeting = greetByHour(new Date().getHours());

  return (
    <div className="animate-fade-in">
      <section className="surface relative overflow-hidden p-8 md:p-10 mb-10">
        <div
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, rgba(196,176,251,0.55), transparent)",
          }}
        />
        <div
          className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full blur-3xl opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,197,137,0.45), transparent)",
          }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-ink-200 px-3 py-1 text-xs font-medium text-ink-700 shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-lavender-500" />
              <span>{greeting}</span>
            </div>
            <h1 className="mt-4 font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Привет,{" "}
              <span className="bg-gradient-to-r from-lavender-500 to-peach-400 bg-clip-text text-transparent">
                {user?.email.split("@")[0]}
              </span>
              .
            </h1>
            <p className="mt-2 text-ink-500 max-w-xl">
              Что сегодня делаем? Можно отсортировать новые слова, попрактиковать
              learning или прогнать большое review.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/words/new" className="btn-pastel-lavender">
              <Plus className="h-4 w-4" /> Своё слово
            </Link>
            <Link to="/onboarding" className="btn-primary">
              Открыть Onboarding
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 md:items-stretch">
        {modes.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="group surface p-6 hover:shadow-lift hover:-translate-y-0.5 transition relative overflow-hidden flex flex-col h-full min-h-0"
          >
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${m.bgClass.split(" ")[0]} ${m.bgClass.split(" ")[1]} opacity-50 blur-2xl`}
            />
            <div className="relative flex flex-col flex-1 min-h-0">
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br border ${m.bgClass}`}
              >
                <m.icon className="h-5 w-5" />
              </div>
              <div className="label mt-5">{m.eyebrow}</div>
              <h3 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-ink-900">
                {m.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">
                {m.description}
              </p>
              <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-ink-800 group-hover:gap-2 transition-all">
                Открыть <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="surface p-6">
          <div className="label">Подсказка</div>
          <h3 className="mt-1.5 font-display text-lg font-semibold">
            Onboarding: слова, которые уже не новые
          </h3>
          <p className="mt-2 text-sm text-ink-600 leading-relaxed">
            <span className="chip bg-rose2-100 border-rose2-200 text-rose-700 mr-1">
              плохо знаю
            </span>
            ,{" "}
            <span className="chip bg-mint-100 border-mint-200 text-emerald-700 mr-1">
              хорошо знаю
            </span>
            ,{" "}
            <span className="chip bg-lavender-100 border-lavender-200 text-lavender-600 mr-1">
              превосходно
            </span>
            — три степени уверенности. Так можно не тратить время на очевидное и
            не начинать с нуля там, где слово уже почти на автомате.
          </p>
        </div>
        <div className="surface p-6">
          <div className="label">Совет</div>
          <h3 className="mt-1.5 font-display text-lg font-semibold">
            Самооценка работает
          </h3>
          <p className="mt-2 text-sm text-ink-600 leading-relaxed">
            Перед тем как нажать «знаю», мысленно проговори ответ полностью —
            это убирает иллюзию знания и держит честный сигнал для алгоритма.
          </p>
        </div>
      </section>
    </div>
  );
}

function greetByHour(h: number) {
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}
