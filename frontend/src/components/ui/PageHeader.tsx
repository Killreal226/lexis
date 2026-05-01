import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
      <div>
        {eyebrow && (
          <div className="label mb-2 text-lavender-500">{eyebrow}</div>
        )}
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-ink-500 max-w-xl text-[15px]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
