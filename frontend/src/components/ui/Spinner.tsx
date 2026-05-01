import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 rounded-full border-2 border-ink-200 border-t-lavender-500 animate-spin",
        className,
      )}
    />
  );
}
