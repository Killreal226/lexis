import type { Direction } from "@/lib/types";
import { cn } from "@/lib/cn";

export const DIRECTION_LABEL: Record<Direction, string> = {
  en_ru: "EN → RU",
  ru_en: "RU → EN",
};

export function DirectionToggle({
  value,
  onChange,
  disabled,
}: {
  value: Direction;
  onChange: (v: Direction) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center rounded-full bg-white border border-ink-200 p-1 shadow-soft">
      {(["en_ru", "ru_en"] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => onChange(dir)}
          disabled={disabled}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            value === dir
              ? "bg-ink-900 text-white"
              : "text-ink-600 hover:text-ink-900",
          )}
        >
          {DIRECTION_LABEL[dir]}
        </button>
      ))}
    </div>
  );
}
