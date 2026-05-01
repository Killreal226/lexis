import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="text-center py-16 px-6 surface bg-white/70 animate-fade-in">
      {icon && (
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-lavender-100 to-mint-100 text-lavender-500">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl font-semibold text-ink-900">{title}</h3>
      {description && (
        <p className="mt-2 text-ink-500 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
