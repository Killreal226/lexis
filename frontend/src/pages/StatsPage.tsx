import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  BarChart3,
  Layers,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { learning } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { LearningBucketStats } from "@/lib/types";
import { cn } from "@/lib/cn";

const BUCKETS = [
  {
    key: "new" as const,
    label: "Новые",
    hint: "level 0",
    barClass: "bg-sky2-300",
    conic: "#7AB8E8",
  },
  {
    key: "in_progress" as const,
    label: "Learning",
    hint: "1–9",
    barClass: "bg-lavender-300",
    conic: "#B8A3F5",
  },
  {
    key: "bad" as const,
    label: "плохо знаю",
    hint: "10–13",
    barClass: "bg-rose2-300",
    conic: "#F5A0B0",
  },
  {
    key: "good" as const,
    label: "хорошо знаю",
    hint: "14–17",
    barClass: "bg-mint-300",
    conic: "#7FD9A8",
  },
  {
    key: "perfect" as const,
    label: "превосходно",
    hint: "18–20",
    barClass: "bg-lavender-500",
    conic: "#8B6CF0",
  },
];

function conicBackground(stats: LearningBucketStats): string {
  const t = stats.total;
  if (t === 0) {
    return "conic-gradient(from -90deg, #E4E4EA 0deg 360deg)";
  }
  let angle = 0;
  const stops: string[] = [];
  for (const b of BUCKETS) {
    const v = stats[b.key];
    if (v <= 0) continue;
    const span = (v / t) * 360;
    const a0 = angle;
    const a1 = angle + span;
    stops.push(`${b.conic} ${a0}deg ${a1}deg`);
    angle = a1;
  }
  if (stops.length === 0) {
    return "conic-gradient(from -90deg, #E4E4EA 0deg 360deg)";
  }
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}

function SegmentedBar({ stats }: { stats: LearningBucketStats }) {
  const t = stats.total;
  if (t === 0) {
    return (
      <div className="h-5 w-full rounded-full bg-ink-100 border border-ink-200/60" />
    );
  }
  return (
    <div className="flex h-5 w-full overflow-hidden rounded-full border border-ink-200/50 shadow-inner">
      {BUCKETS.map((b) => {
        const v = stats[b.key];
        if (v <= 0) return null;
        return (
          <motion.div
            key={b.key}
            layout
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: v }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            className={cn("min-w-0", b.barClass)}
            title={`${b.label}: ${v}`}
            style={{ flexBasis: 0 }}
          />
        );
      })}
    </div>
  );
}

function Donut({
  stats,
  size = "lg",
}: {
  stats: LearningBucketStats;
  size?: "sm" | "lg";
}) {
  const outer =
    size === "lg"
      ? "w-44 h-44 md:w-52 md:h-52"
      : "w-[7.25rem] h-[7.25rem] sm:w-28 sm:h-28";
  const inner =
    size === "lg"
      ? "w-28 h-28 md:w-32 md:h-32"
      : "w-[4.75rem] h-[4.75rem] sm:w-[5.25rem] sm:h-[5.25rem]";
  const t = stats.total;
  return (
    <div className="relative grid place-items-center shrink-0">
      <div
        className={cn(
          outer,
          "rounded-full shadow-soft",
          "ring-1 ring-white/80",
        )}
        style={{ background: conicBackground(stats) }}
      />
      <div
        className={cn(
          "absolute rounded-full bg-white shadow-soft flex flex-col items-center justify-center border border-ink-100",
          inner,
        )}
      >
        {size === "lg" && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            всего
          </span>
        )}
        <span
          className={cn(
            "font-display font-semibold tabular-nums text-ink-900",
            size === "lg" ? "text-2xl md:text-3xl" : "text-lg sm:text-xl",
          )}
        >
          {t}
        </span>
      </div>
    </div>
  );
}

function StatMini({
  bucket,
  value,
  delay,
}: {
  bucket: (typeof BUCKETS)[number];
  value: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-2xl border border-ink-200/70 bg-white/90 px-3 py-2.5 shadow-soft"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("h-2.5 w-2.5 shrink-0 rounded-full", bucket.barClass)}
        />
        <span className="text-xs font-medium text-ink-600 truncate">
          {bucket.label}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="font-display text-lg font-semibold tabular-nums text-ink-900">
          {value}
        </span>
        <span className="text-[10px] text-ink-400 tabular-nums">{bucket.hint}</span>
      </div>
    </motion.div>
  );
}

function DirectionPanel({
  title,
  subtitle,
  stats,
  index,
}: {
  title: string;
  subtitle: string;
  stats: LearningBucketStats;
  index: number;
}) {
  const baseDelay = 0.08 + index * 0.12;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: index * 0.08 }}
      className="surface relative overflow-hidden p-6 md:p-7"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(196,176,251,0.5), transparent)",
        }}
      />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label text-lavender-500">{subtitle}</div>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-ink-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {stats.total === 0
                ? "Пока нет строк progress в этом направлении."
                : `${stats.total} карточек в базе`}
            </p>
          </div>
          <Donut stats={stats} size="sm" />
        </div>
        <SegmentedBar stats={stats} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BUCKETS.map((b, i) => (
            <div key={b.key}>
              <StatMini
                bucket={b}
                value={stats[b.key]}
                delay={baseDelay + i * 0.04}
              />
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

export default function StatsPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["learning", "stats"],
    queryFn: () => learning.stats(),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Аналитика"
        title="Статистика прогресса"
        subtitle="Распределение по уровням: новые и learning (0–9), затем review как в онбординге — «плохо знаю», «хорошо знаю», «превосходно». Направления считаются отдельно."
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="btn-soft"
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
            Обновить
          </button>
        }
      />

      {isPending && (
        <div className="surface p-16 grid place-items-center">
          <div className="flex flex-col items-center gap-4 text-ink-500">
            <Spinner />
            <span className="text-sm">Загружаем цифры…</span>
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-rose2-200 bg-rose2-100/70 px-4 py-3 text-sm text-rose-700">
          {error instanceof ApiError
            ? error.message
            : "Не удалось загрузить статистику."}
        </div>
      )}

      {data && (
        <>
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="surface relative overflow-hidden p-6 md:p-8 mb-8"
          >
            <div
              className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full opacity-35 blur-3xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(255,197,137,0.55), transparent)",
              }}
            />
            <div className="relative flex flex-col md:flex-row md:items-center gap-8 md:gap-12">
              <Donut stats={data.total} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-mint-100 border border-mint-200/80 px-3 py-1 text-xs font-medium text-emerald-800">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Сумма по обоим направлениям
                </div>
                <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink-900">
                  Общая картина
                </h2>
                <p className="mt-2 text-sm text-ink-600 max-w-lg leading-relaxed">
                  Полоса ниже — те же пропорции, что и кольцо. Удобно сравнить,
                  куда уходит больше внимания: learning или уже закреплённые
                  уровни review.
                </p>
                <div className="mt-5 max-w-xl">
                  <SegmentedBar stats={data.total} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {BUCKETS.map((b) => (
                    <span
                      key={b.key}
                      className="chip border-ink-200/80 bg-white/90 text-ink-700"
                    >
                      <span
                        className={cn("h-2 w-2 rounded-full", b.barClass)}
                      />
                      {b.label}:{" "}
                      <strong className="tabular-nums">{data.total[b.key]}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          <div className="grid gap-6 lg:grid-cols-2">
            <DirectionPanel
              index={0}
              title="EN → RU"
              subtitle="Направление"
              stats={data.en_ru}
            />
            <DirectionPanel
              index={1}
              title="RU → EN"
              subtitle="Направление"
              stats={data.ru_en}
            />
          </div>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-10 grid gap-4 md:grid-cols-3"
          >
            <Link
              to="/session/learning"
              className="group surface p-5 flex items-start gap-4 hover:shadow-lift transition"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-mint-100 to-mint-200/80 border border-mint-200/80 text-emerald-700">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display font-semibold text-ink-900 group-hover:text-emerald-800 transition">
                  В Learning
                </div>
                <p className="mt-1 text-sm text-ink-500 leading-relaxed">
                  Продолжить сессию по свежим уровням.
                </p>
              </div>
            </Link>
            <Link
              to="/session/review"
              className="group surface p-5 flex items-start gap-4 hover:shadow-lift transition"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-peach-100 to-peach-200/80 border border-peach-200/80 text-orange-700">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display font-semibold text-ink-900 group-hover:text-orange-800 transition">
                  В Review
                </div>
                <p className="mt-1 text-sm text-ink-500 leading-relaxed">
                  Закрепить слова на уровнях 10+.
                </p>
              </div>
            </Link>
            <Link
              to="/onboarding"
              className="group surface p-5 flex items-start gap-4 hover:shadow-lift transition"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lavender-100 to-lavender-200/80 border border-lavender-200/80 text-lavender-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display font-semibold text-ink-900 group-hover:text-lavender-700 transition">
                  Onboarding
                </div>
                <p className="mt-1 text-sm text-ink-500 leading-relaxed">
                  Добавить новые слова в прогресс.
                </p>
              </div>
            </Link>
          </motion.section>

          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-ink-400">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Счётчики по каждому направлению независимы: одно слово даёт две строки
            в базе.
          </p>
        </>
      )}
    </div>
  );
}
