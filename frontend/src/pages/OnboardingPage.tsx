import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Sprout,
  SkipForward,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import type { Rank, Word } from "@/lib/types";
import { learning } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { drillStorage } from "@/lib/drill-storage";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { WordHero } from "@/components/word/WordHero";

type Phase = "loading" | "ready" | "exhausted" | "submitting";

const RANK_META: Record<Rank, { label: string; chip: string }> = {
  bad: {
    label: "плохо знаю",
    chip: "btn-pastel-rose",
  },
  good: {
    label: "хорошо знаю",
    chip: "btn-pastel-mint",
  },
  perfect: {
    label: "превосходно",
    chip: "btn-pastel-lavender",
  },
};

export default function OnboardingPage() {
  const [current, setCurrent] = useState<Word | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Word[]>([]);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [actionPending, setActionPending] = useState(false);
  const navigate = useNavigate();

  const excludeIds = useMemo(
    () => [...cart.map((w) => w.id), ...Array.from(skipped)],
    [cart, skipped],
  );

  const loadNext = useCallback(
    async (excludes: number[]) => {
      setError(null);
      try {
        const res = await learning.nextCandidate(excludes);
        if (!res.word) {
          setCurrent(null);
          setPhase("exhausted");
        } else {
          setCurrent(res.word);
          setPhase("ready");
        }
      } catch (err) {
        setPhase("ready");
        setError(
          err instanceof ApiError
            ? err.message
            : "Не удалось загрузить следующее слово.",
        );
      }
    },
    [],
  );

  useEffect(() => {
    void loadNext([]);
  }, [loadNext]);

  async function handleAddToCart() {
    if (!current) return;
    const next = [...cart, current];
    setCart(next);
    setActionPending(true);
    await loadNext([
      ...next.map((w) => w.id),
      ...Array.from(skipped),
    ]);
    setActionPending(false);
  }

  async function handleSkip() {
    if (!current) return;
    const nextSkipped = new Set(skipped);
    nextSkipped.add(current.id);
    setSkipped(nextSkipped);
    setActionPending(true);
    await loadNext([
      ...cart.map((w) => w.id),
      ...Array.from(nextSkipped),
    ]);
    setActionPending(false);
  }

  async function handleRate(rank: Rank) {
    if (!current) return;
    setActionPending(true);
    try {
      await learning.rate(current.id, rank);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не получилось оценить слово.",
      );
    }
    await loadNext(excludeIds);
    setActionPending(false);
  }

  function removeFromCart(id: number) {
    setCart((prev) => prev.filter((w) => w.id !== id));
  }

  async function startLearning() {
    if (!cart.length) return;
    setPhase("submitting");
    try {
      await learning.batchStart(cart.map((w) => w.id));
      // Кладём корзину в sessionStorage и идём зубрить — прогресс на бэке
      // уже создан, так что в случае рефреша он не потеряется.
      drillStorage.set(cart);
      navigate("/onboarding/drill");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не получилось отправить корзину.",
      );
      setPhase("ready");
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-3 text-ink-500 py-20 justify-center">
        <Spinner /> <span>Подбираем первое слово…</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Onboarding"
        title="Учить новые слова"
        subtitle="Слова, с которыми ещё нет прогресса. Собери в корзину то, что хочешь выучить с нуля, пропусти, что не сейчас, или отметь, насколько хорошо слово уже знаешь."
        actions={
          <div className="flex items-center gap-2">
            <div className="chip bg-white border-ink-200 text-ink-700">
              <ShoppingBag className="h-3.5 w-3.5" /> {cart.length} в корзине
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={!cart.length || phase === "submitting"}
              onClick={startLearning}
            >
              {phase === "submitting" ? (
                <Spinner className="border-white/40 border-t-white" />
              ) : null}
              Учить корзину
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-5 rounded-2xl border border-rose2-200 bg-rose2-100/70 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="surface p-7 md:p-9">
          {phase === "exhausted" || !current ? (
            <EmptyStateInline
              cartCount={cart.length}
              onStart={startLearning}
              submitting={phase === "submitting"}
            />
          ) : (
            <>
              <WordHero word={current} />

              <div className="divider my-7" />

              <div className="space-y-5">
                <div>
                  <div className="label mb-2">Я уже знаю это слово</div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(RANK_META) as Rank[]).map((rank) => (
                      <button
                        type="button"
                        key={rank}
                        onClick={() => handleRate(rank)}
                        className={`${RANK_META[rank].chip}`}
                        disabled={actionPending}
                      >
                        <Check className="h-4 w-4" />
                        {RANK_META[rank].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="label mb-2">Не знаю / нужно подумать</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="btn-pastel-sky"
                      disabled={actionPending}
                    >
                      <ShoppingBag className="h-4 w-4" />В корзину «учить»
                    </button>
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="btn-soft"
                      disabled={actionPending}
                    >
                      <SkipForward className="h-4 w-4" />
                      Пропустить
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <CartSidebar items={cart} onRemove={removeFromCart} />
      </div>
    </div>
  );
}

function EmptyStateInline({
  cartCount,
  onStart,
  submitting,
}: {
  cartCount: number;
  onStart: () => void;
  submitting: boolean;
}) {
  return (
    <div className="text-center py-10">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-mint-100 to-lavender-100 text-emerald-700">
        <Sprout className="h-6 w-6" />
      </div>
      <h3 className="font-display text-xl font-semibold">Новых слов больше нет</h3>
      <p className="mt-2 text-ink-500 max-w-md mx-auto">
        Все доступные слова отсортированы. Можно отправить корзину в learning.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={!cartCount || submitting}
          onClick={onStart}
        >
          Учить {cartCount} слов
        </button>
        <Link to="/" className="btn-soft">
          На главную
        </Link>
      </div>
    </div>
  );
}

function CartSidebar({
  items,
  onRemove,
}: {
  items: Word[];
  onRemove: (id: number) => void;
}) {
  return (
    <aside className="surface p-5 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="label">Корзина «учить»</div>
          <div className="font-display text-lg font-semibold">
            {items.length} {wordPlural(items.length)}
          </div>
        </div>
        <ShoppingBag className="h-5 w-5 text-ink-400" />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-ink-500 leading-relaxed">
          Пока пусто. Складывай сюда слова, которые хочешь зубрить с нуля.
        </p>
      ) : (
        <ul className="overflow-y-auto -mx-1 px-1 space-y-1.5">
          {items.map((w) => (
            <li
              key={w.id}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{w.word}</div>
                <div className="text-xs text-ink-500 truncate">
                  {w.translation}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(w.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-ink-400 hover:text-rose-600 hover:bg-rose2-100 transition"
                title="Убрать"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
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
