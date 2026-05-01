import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  Check,
  ImageIcon,
  PartyPopper,
  RotateCcw,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExampleForSide } from "@/components/word/ExampleForSide";
import { DIRECTION_LABEL } from "@/components/word/DirectionToggle";
import { cn, shuffle } from "@/lib/cn";
import { drillStorage } from "@/lib/drill-storage";
import {
  resolveImagePath,
  type Direction,
  type Word,
} from "@/lib/types";

type Mode = Direction | "mix";

type DrillItem = { word: Word; direction: Direction };

const MODE_LABEL: Record<Mode, string> = {
  en_ru: "EN → RU",
  ru_en: "RU → EN",
  mix: "Микс",
};

function pickDirection(mode: Mode): Direction {
  if (mode === "mix") return Math.random() < 0.5 ? "en_ru" : "ru_en";
  return mode;
}

function buildQueue(words: Word[], mode: Mode): DrillItem[] {
  return shuffle(words).map((w) => ({ word: w, direction: pickDirection(mode) }));
}

export default function DrillPage() {
  // Грузим корзину один раз при монтировании. Если пусто — редирект.
  const initial = useMemo(() => drillStorage.get(), []);
  if (!initial) {
    return <Navigate to="/onboarding" replace />;
  }
  return <DrillPageInner sourceWords={initial.words} />;
}

function DrillPageInner({ sourceWords }: { sourceWords: Word[] }) {
  const [mode, setMode] = useState<Mode>("en_ru");
  const [queue, setQueue] = useState<DrillItem[]>(() =>
    buildQueue(sourceWords, "en_ru"),
  );
  const [mastered, setMastered] = useState<Word[]>([]);
  const [circles, setCircles] = useState(1);
  const [flipped, setFlipped] = useState(false);

  const total = sourceWords.length;
  const remaining = queue.length;
  const masteredCount = mastered.length;
  const completed = remaining === 0;
  const current = queue[0] ?? null;

  function handleKnown() {
    if (!current) return;
    setQueue((q) => q.slice(1));
    setMastered((m) => [...m, current.word]);
    setFlipped(false);
  }

  function handleAgain() {
    if (!current) return;
    setQueue((q) => {
      const [head, ...rest] = q;
      const refreshed: DrillItem = {
        ...head,
        direction: pickDirection(mode),
      };
      return [...rest, refreshed];
    });
    setFlipped(false);
  }

  function handleShuffle() {
    setQueue((q) => buildQueue(q.map((it) => it.word), mode));
    setFlipped(false);
  }

  function handleRestart() {
    setQueue(buildQueue(sourceWords, mode));
    setMastered([]);
    setCircles((c) => c + 1);
    setFlipped(false);
  }

  function handleChangeMode(next: Mode) {
    setMode(next);
    // Пересчитываем направления у уже стоящей очереди, не сбивая порядок.
    setQueue((q) =>
      q.map((it) => ({ ...it, direction: pickDirection(next) })),
    );
    setFlipped(false);
  }

  const onSpaceFlip = useCallback(() => setFlipped((f) => !f), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"))
        return;
      if (completed || !current) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        onSpaceFlip();
      } else if (flipped) {
        if (e.key === "ArrowRight" || e.key.toLowerCase() === "k") {
          e.preventDefault();
          handleKnown();
        } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") {
          e.preventDefault();
          handleAgain();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, completed, current?.word.id]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Зубрёжка корзины"
        title={`${total} ${wordPlural(total)} в работе`}
        subtitle="Перевернуть — клик / space / enter. «Знаю» вынимает из круга, «Ещё раз» отправляет в конец."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ModeSwitch value={mode} onChange={handleChangeMode} />
            <button
              type="button"
              className="btn-soft"
              onClick={handleShuffle}
              disabled={completed}
              title="Перемешать оставшиеся"
            >
              <Shuffle className="h-4 w-4" />
              Перемешать
            </button>
            <FinishButton />
          </div>
        }
      />

      <StatsBar
        total={total}
        remaining={remaining}
        mastered={masteredCount}
        circles={circles}
      />

      <div className="mt-6">
        {completed ? (
          <CompletionScreen
            total={total}
            mastered={masteredCount}
            circles={circles}
            onRestart={handleRestart}
          />
        ) : current ? (
          <DrillCard
            item={current}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
            onKnown={handleKnown}
            onAgain={handleAgain}
          />
        ) : null}
      </div>

      {!completed && (
        <p className="mt-6 text-center text-xs text-ink-400">
          <kbd className="kbd">space</kbd> — показать ответ&nbsp; ·&nbsp;
          <kbd className="kbd">←</kbd> ещё раз&nbsp; ·&nbsp;
          <kbd className="kbd">→</kbd> знаю
        </p>
      )}

      <style>{`.kbd{display:inline-block;padding:1px 6px;border-radius:6px;border:1px solid #E4E4EA;background:#fff;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;color:#56566A}`}</style>
    </div>
  );
}

function FinishButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="btn-primary"
      onClick={() => {
        drillStorage.clear();
        navigate("/", { replace: true });
      }}
    >
      Закончить
    </button>
  );
}

function ModeSwitch({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full bg-white border border-ink-200 p-1 shadow-soft">
      {(["en_ru", "ru_en", "mix"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            value === m
              ? "bg-ink-900 text-white"
              : "text-ink-600 hover:text-ink-900",
          )}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

function StatsBar({
  total,
  remaining,
  mastered,
  circles,
}: {
  total: number;
  remaining: number;
  mastered: number;
  circles: number;
}) {
  const inRotation = total - mastered;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat
        label="Всего в пачке"
        value={total}
        accent="bg-ink-100 text-ink-700"
        icon={<Sparkles className="h-4 w-4" />}
      />
      <Stat
        label="Осталось в круге"
        value={`${remaining}/${Math.max(inRotation, 1)}`}
        accent="bg-lavender-100 text-lavender-600"
        icon={<RotateCcw className="h-4 w-4" />}
      />
      <Stat
        label="Знаю"
        value={mastered}
        accent="bg-mint-100 text-emerald-700"
        icon={<Check className="h-4 w-4" />}
      />
      <Stat
        label="Кругов"
        value={circles}
        accent="bg-peach-100 text-orange-700"
        icon={<Shuffle className="h-4 w-4" />}
      />
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
  value: number | string;
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

function DrillCard({
  item,
  flipped,
  onFlip,
  onKnown,
  onAgain,
}: {
  item: DrillItem;
  flipped: boolean;
  onFlip: () => void;
  onKnown: () => void;
  onAgain: () => void;
}) {
  const { word, direction } = item;
  const isEnRu = direction === "en_ru";
  const promptText = isEnRu ? word.word : word.translation;
  const answerText = isEnRu ? word.translation : word.word;
  const promptLang = isEnRu ? "EN" : "RU";
  const answerLang = isEnRu ? "RU" : "EN";
  const imagePath = resolveImagePath(word.image_path);

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
              direction={direction}
              imagePath={imagePath}
              exampleEn={word.example_en}
              exampleRu={word.example_ru ?? undefined}
              hint="Клик / space — показать ответ"
            />
            <CardFace
              side="back"
              text={answerText}
              lang={answerLang}
              direction={direction}
              imagePath={imagePath}
              exampleEn={word.example_en}
              exampleRu={word.example_ru ?? undefined}
            />
          </div>
        </button>
      </div>

      <div className="space-y-3">
        <div className="surface p-5">
          <div className="label">К карточке</div>
          <div className="mt-1 text-xs text-ink-500">
            Лицо · {promptLang} · ответ · {answerLang}
          </div>
          <div className="mt-2 font-display text-xl font-semibold tracking-tight break-words">
            {promptText}
          </div>
          <div className="mt-1 text-sm text-ink-600 break-words">{answerText}</div>
          <div className="mt-3 chip bg-white border-ink-200 text-ink-700">
            {MODE_LABEL[direction]}
          </div>
        </div>

        <div className="surface p-5 space-y-3">
          <button
            type="button"
            onClick={onKnown}
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
            onClick={onAgain}
            disabled={!flipped}
            className={cn(
              "btn-pastel-rose w-full !py-3 !text-base",
              !flipped && "opacity-50 cursor-not-allowed",
            )}
          >
            <X className="h-5 w-5" /> Ещё раз
          </button>
          {!flipped && (
            <p className="text-xs text-ink-500 text-center">
              Сначала вспомни мысленно — потом переворачивай.
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
  direction,
  imagePath,
  hint,
  exampleEn,
  exampleRu,
}: {
  side: "front" | "back";
  text: string;
  lang: string;
  direction: Direction;
  imagePath: string | null;
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
          {side === "front" ? "вопрос" : "ответ"}
        </span>
      </div>

      {/* justify-between на карточке + h-full: лишнее место делится между зонами, без «пробела только снизу» */}
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
          ? hint || "Кликни, чтобы перевернуть"
          : "Готово? Оцени себя справа."}
      </div>
    </div>
  );
}

function CompletionScreen({
  total,
  mastered,
  circles,
  onRestart,
}: {
  total: number;
  mastered: number;
  circles: number;
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="surface relative overflow-hidden p-10 md:p-14 text-center animate-scale-in">
      <div
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, rgba(146,226,182,0.55), transparent)",
        }}
      />
      <div
        className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, rgba(196,176,251,0.45), transparent)",
        }}
      />
      <div className="relative">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-mint-200 to-lavender-200 text-emerald-700 shadow-glow">
          <PartyPopper className="h-6 w-6" />
        </div>
        <h2 className="mt-5 font-display text-3xl md:text-4xl font-semibold tracking-tight">
          Круг закрыт
        </h2>
        <p className="mt-2 text-ink-600">
          Прогнал{" "}
          <span className="font-medium text-ink-900">
            {mastered} из {total}
          </span>{" "}
          {wordPlural(mastered)} за {circles}{" "}
          {circles === 1 ? "круг" : "круга/-ов"}. Можно пройтись ещё раз или
          переходить в learning — прогресс уже создан.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-pastel-lavender" onClick={onRestart}>
            <RotateCcw className="h-4 w-4" />
            Прогнать ещё раз
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              drillStorage.clear();
              navigate("/session/learning");
            }}
          >
            <Sparkles className="h-4 w-4" />К learning
          </button>
          <Link
            to="/"
            className="btn-soft"
            onClick={() => drillStorage.clear()}
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

function wordPlural(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "слово";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100))
    return "слова";
  return "слов";
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
