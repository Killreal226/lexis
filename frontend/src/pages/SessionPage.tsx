import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  Brain,
  Check,
  ChevronRight,
  ImageIcon,
  Layers,
  RefreshCcw,
  Sparkles,
  X,
  GraduationCap,
} from "lucide-react";
import {
  resolveImagePath,
  type Direction,
  type Mode,
  type NextCardResponse,
} from "@/lib/types";
import { learning } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DirectionToggle,
  DIRECTION_LABEL,
} from "@/components/word/DirectionToggle";
import { ExampleForSide } from "@/components/word/ExampleForSide";
import { cn } from "@/lib/cn";

type LoadedCard = Extract<NextCardResponse, { progress_id: number }>;

type SessionStats = {
  answered: number;
  known: number;
  unknown: number;
  graduated: number;
};

const MODE_META: Record<
  Mode,
  { label: string; eyebrow: string; icon: typeof Layers; helper: string }
> = {
  learning: {
    label: "Learning",
    eyebrow: "Сессия · level 0–9",
    icon: Layers,
    helper:
      "«Знаю» двигает уровень вперёд и до конца круга не показывается снова. «Не знаю» — уровень без изменений, карточка крутится в очереди, пока не нажмёшь «знаю». Направления EN→RU и RU→EN независимы.",
  },
  review: {
    label: "Review",
    eyebrow: "Сессия · level 10+",
    icon: RefreshCcw,
    helper:
      "Внутренний алгоритм подбирает очередь и учитывает твои ответы: чаще показывает то, что ещё не село в память, и реже — то, что уже держишь уверенно.",
  },
};

export default function SessionPage({ mode }: { mode: Mode }) {
  const [direction, setDirection] = useState<Direction>("en_ru");
  const [card, setCard] = useState<LoadedCard | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "exhausted">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    answered: 0,
    known: 0,
    unknown: 0,
    graduated: 0,
  });
  const submittingRef = useRef(false);
  /** Learning: progress_id с ответом «знаю» в этой сессии по направлению — не показываем снова до круга; «не знаю» не попадает сюда. */
  const learningSessionExcludeRef = useRef<Record<Direction, number[]>>({
    en_ru: [],
    ru_en: [],
  });

  const meta = MODE_META[mode];

  const loadNext = useCallback(
    async (dir: Direction) => {
      setError(null);
      setFlipped(false);
      setPhase("loading");
      try {
        const exclude =
          mode === "learning"
            ? learningSessionExcludeRef.current[dir]
            : undefined;
        const res = await learning.next(mode, dir, exclude);
        if (res.progress_id === null) {
          setCard(null);
          setPhase("exhausted");
        } else {
          setCard(res as LoadedCard);
          setPhase("ready");
        }
      } catch (err) {
        setPhase("ready");
        setError(
          err instanceof ApiError
            ? err.message
            : "Не получилось загрузить карточку.",
        );
      }
    },
    [mode],
  );

  useEffect(() => {
    learningSessionExcludeRef.current = { en_ru: [], ru_en: [] };
  }, [mode]);

  useEffect(() => {
    setStats({ answered: 0, known: 0, unknown: 0, graduated: 0 });
    void loadNext(direction);
  }, [mode, direction, loadNext]);

  const submitAnswer = useCallback(
    async (known: boolean) => {
      if (!card || submittingRef.current) return;
      submittingRef.current = true;
      try {
        const res = await learning.answer(card.progress_id, known);
        setStats((s) => ({
          answered: s.answered + 1,
          known: s.known + (known ? 1 : 0),
          unknown: s.unknown + (known ? 0 : 1),
          graduated: s.graduated + (res.graduated ? 1 : 0),
        }));
        if (mode === "learning" && known) {
          const list = learningSessionExcludeRef.current[direction];
          learningSessionExcludeRef.current[direction] = [...list, card.progress_id];
        }
        await loadNext(direction);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Не получилось отправить ответ.",
        );
      } finally {
        submittingRef.current = false;
      }
    },
    [card, direction, loadNext, mode],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (phase !== "ready" || !card) return;
      if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      } else if (flipped) {
        if (e.key === "ArrowRight" || e.key.toLowerCase() === "k") {
          e.preventDefault();
          void submitAnswer(true);
        } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") {
          e.preventDefault();
          void submitAnswer(false);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, flipped, card, submitAnswer]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={meta.eyebrow}
        title={`Повторение · ${meta.label}`}
        subtitle={meta.helper}
        actions={
          <div className="flex items-center gap-2">
            <DirectionToggle
              value={direction}
              onChange={setDirection}
              disabled={phase === "loading"}
            />
            <Link to="/" className="btn-soft">
              Закончить
            </Link>
          </div>
        }
      />

      {error && (
        <div className="mb-5 rounded-2xl border border-rose2-200 bg-rose2-100/70 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <SessionStatsBar stats={stats} />

      <div className="mt-6">
        {phase === "loading" && (
          <div className="surface p-12 grid place-items-center">
            <div className="flex items-center gap-3 text-ink-500">
              <Spinner /> <span>Готовим карточку…</span>
            </div>
          </div>
        )}

        {phase === "exhausted" && (
          <EmptyState
            icon={<GraduationCap className="h-7 w-7" />}
            title={
              stats.answered > 0
                ? "Сессия завершена"
                : `В режиме ${meta.label} пока пусто`
            }
            description={
              stats.answered > 0
                ? `Ответил на ${stats.answered}, из них «знаю» — ${stats.known}, «не знаю» — ${stats.unknown}.`
                : mode === "learning"
                  ? "Кажется, в learning нет активных слов. Зайди во вкладку Onboarding и сложи слова в корзину."
                  : "В review ещё нет слов. Начни с learning — пройди до level 10."
            }
            action={
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => loadNext(direction)}
                >
                  <RefreshCcw className="h-4 w-4" /> Ещё круг
                </button>
                <Link to="/" className="btn-soft">
                  На главную
                </Link>
              </div>
            }
          />
        )}

        {phase === "ready" && card && (
          <FlipCard
            card={card}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
            onAnswer={submitAnswer}
          />
        )}
      </div>

      {phase === "ready" && (
        <p className="mt-6 text-center text-xs text-ink-400">
          <kbd className="kbd">space</kbd> — показать ответ&nbsp; ·&nbsp;
          <kbd className="kbd">←</kbd> не знаю&nbsp; ·&nbsp;
          <kbd className="kbd">→</kbd> знаю
        </p>
      )}

      <style>{`.kbd{display:inline-block;padding:1px 6px;border-radius:6px;border:1px solid #E4E4EA;background:#fff;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;color:#56566A}`}</style>
    </div>
  );
}

function SessionStatsBar({ stats }: { stats: SessionStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Ответов" value={stats.answered} icon={<Brain className="h-4 w-4" />} accent="bg-ink-100 text-ink-700" />
      <Stat label="Знаю" value={stats.known} icon={<Check className="h-4 w-4" />} accent="bg-mint-100 text-emerald-700" />
      <Stat label="Не знаю" value={stats.unknown} icon={<X className="h-4 w-4" />} accent="bg-rose2-100 text-rose-700" />
      <Stat label="Перешло в review" value={stats.graduated} icon={<Sparkles className="h-4 w-4" />} accent="bg-lavender-100 text-lavender-600" />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="surface px-4 py-3 flex items-center gap-3">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${accent}`}>
        {icon}
      </span>
      <div className="leading-tight">
        <div className="font-display text-xl font-semibold tabular-nums">
          {value}
        </div>
        <div className="text-xs text-ink-500">{label}</div>
      </div>
    </div>
  );
}

function FlipCard({
  card,
  flipped,
  onFlip,
  onAnswer,
}: {
  card: LoadedCard;
  flipped: boolean;
  onFlip: () => void;
  onAnswer: (known: boolean) => void;
}) {
  const { word, direction, level } = card;
  const isEnRu = direction === "en_ru";
  const promptText = isEnRu ? word.word : word.translation;
  const answerText = isEnRu ? word.translation : word.word;
  const promptLang = isEnRu ? "EN" : "RU";
  const answerLang = isEnRu ? "RU" : "EN";

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flip-perspective">
        <button
          type="button"
          onClick={onFlip}
          className={cn(
            "relative block w-full text-left",
            !flipped && "cursor-pointer",
          )}
        >
          <div
            className={cn(
              "flip-inner drill-flip-inner relative w-full min-h-0",
              flipped && "flip-flipped",
            )}
          >
            <CardFace
              side="front"
              text={promptText}
              lang={promptLang}
              level={level}
              direction={direction}
              imagePath={resolveImagePath(word.image_path)}
              exampleEn={word.example_en}
              exampleRu={word.example_ru ?? undefined}
              hint="Нажми, space или enter — показать ответ"
            />
            <CardFace
              side="back"
              text={answerText}
              lang={answerLang}
              level={level}
              direction={direction}
              imagePath={resolveImagePath(word.image_path)}
              exampleEn={word.example_en}
              exampleRu={word.example_ru ?? undefined}
            />
          </div>
        </button>
      </div>

      <div className="space-y-3">
        <div className="surface p-5">
          <div className="label">Прогресс</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
            level {level}
          </div>
          <div className="mt-2 text-xs text-ink-500">
            {DIRECTION_LABEL[direction]}
          </div>
          <div className="mt-4 pt-4 border-t border-ink-100 space-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">
                Лицо · {promptLang}
              </div>
              <div className="mt-0.5 text-sm font-medium text-ink-900 break-words">
                {promptText}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">
                Ответ · {answerLang}
              </div>
              <div className="mt-0.5 text-sm text-ink-600 break-words">{answerText}</div>
            </div>
          </div>
        </div>

        <div className="surface p-5 space-y-3">
          <button
            type="button"
            onClick={() => onAnswer(true)}
            disabled={!flipped}
            className={cn(
              "btn-pastel-mint w-full !py-3 !text-base",
              !flipped && "opacity-50 cursor-not-allowed",
            )}
          >
            <Check className="h-5 w-5" /> Знаю
          </button>
          <button
            type="button"
            onClick={() => onAnswer(false)}
            disabled={!flipped}
            className={cn(
              "btn-pastel-rose w-full !py-3 !text-base",
              !flipped && "opacity-50 cursor-not-allowed",
            )}
          >
            <X className="h-5 w-5" /> Не знаю
          </button>
          {!flipped && (
            <p className="text-xs text-ink-500 text-center">
              Сперва вспомни мысленно — потом переворачивай.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CardFace({
  side,
  text,
  lang,
  level,
  direction,
  imagePath,
  hint,
  exampleEn,
  exampleRu,
}: {
  side: "front" | "back";
  text: string;
  lang: string;
  level: number;
  direction: Direction;
  imagePath: string | null | undefined;
  hint?: string;
  exampleEn?: string;
  exampleRu?: string;
}) {
  const accent = useMemo(() => pickAccent(direction, side), [direction, side]);
  return (
    <div
      className={cn(
        "drill-flip-face surface flex h-full min-h-0 flex-col justify-between gap-4 p-6 md:p-8 overflow-hidden",
        side === "back" && "flip-back",
      )}
      style={{ background: accent.bg }}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-white/80 border-white text-ink-700">
            {DIRECTION_LABEL[direction]}
          </span>
          <span className="chip bg-white/80 border-white text-ink-700">
            <ArrowLeftRight className="h-3 w-3" /> {lang}
          </span>
        </div>
        <span className="chip shrink-0 bg-white/80 border-white text-ink-700">
          level {level}
        </span>
      </div>

      <div className="grid min-h-0 gap-6 md:grid-cols-[minmax(0,1fr)_280px] md:items-start md:gap-6">
        <div className="min-w-0 flex flex-col justify-start">
          <h3 className="font-display text-3xl md:text-[2.75rem] md:leading-tight font-semibold tracking-tight break-words">
            {text}
          </h3>
          <ExampleForSide
            side={side}
            direction={direction}
            exampleEn={exampleEn}
            exampleRu={exampleRu}
          />
        </div>

        {imagePath ? (
          <div className="mx-auto w-full max-w-[280px] md:mx-0 md:max-w-none md:w-[280px] shrink-0 aspect-square rounded-3xl overflow-hidden border border-ink-200 bg-ink-50 shadow-soft">
            <img
              src={imagePath}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-[280px] md:mx-0 md:w-[280px] aspect-square place-items-center rounded-3xl border border-dashed border-ink-200 bg-gradient-to-br from-ink-50 to-white text-ink-400 shrink-0">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="shrink-0 pt-1 text-xs text-ink-600/80">
        {side === "front"
          ? hint || "Нажми, чтобы перевернуть"
          : "Готово? Оцени себя в правой панели."}
        <ChevronRight className="inline h-3 w-3 ml-0.5" />
      </div>
    </div>
  );
}

function pickAccent(
  direction: Direction,
  side: "front" | "back",
): { bg: string } {
  if (side === "front") {
    return direction === "en_ru"
      ? {
          bg: "linear-gradient(135deg, rgba(237,230,255,0.95), rgba(255,237,217,0.85))",
        }
      : {
          bg: "linear-gradient(135deg, rgba(222,247,234,0.95), rgba(225,241,255,0.85))",
        };
  }
  return direction === "en_ru"
    ? {
        bg: "linear-gradient(135deg, rgba(225,241,255,0.95), rgba(237,230,255,0.85))",
      }
    : {
        bg: "linear-gradient(135deg, rgba(255,237,217,0.95), rgba(222,247,234,0.85))",
      };
}
