import { resolveImagePath, type Word } from "@/lib/types";
import { ImageIcon } from "lucide-react";

type Props = {
  word: Word;
  hideTranslation?: boolean;
};

export function WordHero({ word, hideTranslation }: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px] items-center">
      <div>
        <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
          {word.word}
        </h2>
        {!hideTranslation && (
          <div className="mt-3 text-xl md:text-2xl text-ink-700 font-medium">
            {word.translation}
          </div>
        )}

        <div className="mt-5 space-y-2">
          <ExampleLine lang="EN" text={word.example_en} />
          {word.example_ru?.trim() ? (
            <ExampleLine lang="RU" text={word.example_ru.trim()} />
          ) : null}
        </div>
      </div>

      <WordImage path={resolveImagePath(word.image_path)} alt={word.word} imageKey={word.id} />
    </div>
  );
}

function ExampleLine({ lang, text }: { lang: "EN" | "RU"; text: string }) {
  return (
    <div className="rounded-xl border border-ink-200/60 bg-ink-50/50 px-3 py-2 text-sm text-ink-700 leading-relaxed">
      <span className="label mr-2">{lang}</span>
      {text}
    </div>
  );
}

function WordImage({
  path,
  alt,
  imageKey,
}: {
  path: string | null;
  alt: string;
  imageKey: number;
}) {
  if (!path) {
    return (
      <div className="aspect-square rounded-3xl border border-dashed border-ink-200 bg-gradient-to-br from-ink-50 to-white grid place-items-center text-ink-400">
        <div className="flex flex-col items-center gap-2 text-xs">
          <ImageIcon className="h-6 w-6" />
          <span>без картинки</span>
        </div>
      </div>
    );
  }
  return (
    <div className="aspect-square rounded-3xl overflow-hidden border border-ink-200 bg-ink-50 shadow-soft">
      <img
        key={`${imageKey}-${path}`}
        src={path}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
