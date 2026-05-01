import type { Direction } from "@/lib/types";

type Props = {
  side: "front" | "back";
  direction: Direction;
  exampleEn?: string;
  exampleRu?: string;
};

/** EN→RU: лицо — пример EN, ответ — RU. RU→EN: лицо — RU, ответ — EN. */
export function ExampleForSide({
  side,
  direction,
  exampleEn,
  exampleRu,
}: Props) {
  const isEnRu = direction === "en_ru";
  const en = exampleEn?.trim();
  const ru = exampleRu?.trim();
  const text =
    side === "front" ? (isEnRu ? en : ru) : isEnRu ? ru : en;
  const label =
    side === "front" ? (isEnRu ? "EN" : "RU") : isEnRu ? "RU" : "EN";

  if (!text) {
    return (
      <p className="mt-4 text-sm text-ink-400">Примера на этом шаге нет.</p>
    );
  }
  return (
    <div className="mt-4 text-[15px] text-ink-700">
      <div className="rounded-xl bg-white/70 border border-white px-3 py-2">
        <span className="label mr-2">{label}</span>
        {text}
      </div>
    </div>
  );
}
