import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  ImagePlus,
  Info,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { words as wordsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import type { CheckResponse, Word, WordSimilar } from "@/lib/types";
import { resolveImagePath } from "@/lib/types";
import { cn } from "@/lib/cn";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

export default function NewWordPage() {
  const navigate = useNavigate();

  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [exampleEn, setExampleEn] = useState("");
  const [exampleRu, setExampleRu] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const [check, setCheck] = useState<CheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordTrimmed = word.trim();

  // Debounced duplicate check
  useEffect(() => {
    setAcknowledged(false);
    if (wordTrimmed.length < 2) {
      setCheck(null);
      return;
    }
    const handle = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await wordsApi.check(wordTrimmed);
        setCheck(res);
      } catch {
        setCheck(null);
      } finally {
        setChecking(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [wordTrimmed]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const hasSimilar = !!check?.similar.length;
  const hasContains = !!check?.contains.length;
  const needsAck = hasSimilar || hasContains;

  const canSubmit = useMemo(() => {
    if (!wordTrimmed) return false;
    if (!translation.trim()) return false;
    if (!exampleEn.trim()) return false;
    if (needsAck && !acknowledged) return false;
    return true;
  }, [wordTrimmed, translation, exampleEn, needsAck, acknowledged]);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      setImageError("Поддерживаются JPEG, PNG, WebP.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Файл больше 5 МБ.");
      e.target.value = "";
      return;
    }
    setImageFile(file);
  }

  function clearImage() {
    setImageFile(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fd = new FormData();
      fd.set("word", wordTrimmed);
      fd.set("translation", translation.trim());
      fd.set("example_en", exampleEn.trim());
      if (exampleRu.trim()) fd.set("example_ru", exampleRu.trim());
      if (imageFile) fd.set("image", imageFile);
      const created = await wordsApi.create(fd);
      navigate("/onboarding", {
        replace: true,
        state: { createdWordId: created.id },
      });
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Не получилось создать слово. Попробуй ещё раз.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Своё слово"
        title="Добавить слово в личный словарь"
        subtitle="Слово видно только тебе. Оно попадёт в общий пул новых — увидишь его в Onboarding."
        actions={
          <Link to="/" className="btn-soft">
            Отмена
          </Link>
        }
      />

      <form
        onSubmit={onSubmit}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start"
      >
        <div className="surface p-6 md:p-8 space-y-5">
          <Field
            label="Слово (EN)"
            required
            value={word}
            onChange={setWord}
            placeholder="backyard"
            autoFocus
          />
          <Field
            label="Перевод"
            required
            value={translation}
            onChange={setTranslation}
            placeholder="задний двор"
          />
          <Field
            label="Пример (EN)"
            required
            value={exampleEn}
            onChange={setExampleEn}
            multiline
            placeholder="We play in the backyard."
          />
          <Field
            label="Пример (RU)"
            value={exampleRu}
            onChange={setExampleRu}
            multiline
            placeholder="Мы играем на заднем дворе."
          />

          <div>
            <span className="label block mb-2">Картинка (опционально)</span>
            <ImageDropzone
              ref={fileInputRef}
              file={imageFile}
              preview={imagePreview}
              onChange={handleFile}
              onClear={clearImage}
              error={imageError}
            />
          </div>

          {submitError && (
            <div className="rounded-2xl border border-rose2-200 bg-rose2-100/70 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-ink-500">
              JPEG / PNG / WebP, до 5 МБ. Имя файла бэк сгенерит сам.
            </p>
            <button
              type="submit"
              className="btn-primary"
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <Spinner className="border-white/40 border-t-white" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {submitting ? "Создаём…" : "Создать слово"}
            </button>
          </div>
        </div>

        <DuplicatesPanel
          query={wordTrimmed}
          check={check}
          loading={checking}
          needsAck={needsAck}
          acknowledged={acknowledged}
          onAcknowledge={setAcknowledged}
        />
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  multiline,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="label block mb-2">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {multiline ? (
        <textarea
          className="input min-h-[88px] resize-y"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
        />
      ) : (
        <input
          autoFocus={autoFocus}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
        />
      )}
    </label>
  );
}

type DropzoneProps = {
  file: File | null;
  preview: string | null;
  error: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
};

const ImageDropzone = forwardRef<HTMLInputElement, DropzoneProps>(
  function ImageDropzone({ file, preview, error, onChange, onClear }, ref) {
    return (
      <div>
        <label className="block cursor-pointer">
          <input
            ref={ref}
            type="file"
            accept={ALLOWED_MIME.join(",")}
            className="sr-only"
            onChange={onChange}
          />
          {preview ? (
            <div className="relative rounded-2xl overflow-hidden border border-ink-200 bg-white">
              <img
                src={preview}
                alt="preview"
                className="h-44 w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onClear();
                }}
                className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 border border-ink-200 text-ink-700 hover:bg-white"
                title="Убрать"
              >
                <X className="h-4 w-4" />
              </button>
              {file && (
                <div className="absolute bottom-2 left-2 chip bg-white/90 border-white text-ink-700">
                  {prettySize(file.size)}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-gradient-to-br from-ink-50 to-white px-5 py-10 text-center text-ink-500 hover:border-lavender-300 hover:bg-lavender-50/40 transition">
              <ImagePlus className="mx-auto h-6 w-6 mb-2 text-lavender-400" />
              <div className="text-sm font-medium text-ink-700">
                Перетащи или выбери файл
              </div>
              <div className="text-xs text-ink-500 mt-1">
                JPEG · PNG · WebP, до 5 МБ
              </div>
            </div>
          )}
        </label>
        {error && (
          <p className="mt-2 text-xs text-rose-600 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
      </div>
    );
  },
);

function prettySize(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1000) return `${kb.toFixed(0)} КБ`;
  return `${(kb / 1024).toFixed(1)} МБ`;
}

function DuplicatesPanel({
  query,
  check,
  loading,
  needsAck,
  acknowledged,
  onAcknowledge,
}: {
  query: string;
  check: CheckResponse | null;
  loading: boolean;
  needsAck: boolean;
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
}) {
  if (query.length < 2) {
    return (
      <aside className="surface p-5 sticky top-24">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-lavender-100 text-lavender-500">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium">Проверка дубликатов</div>
            <p className="mt-1 text-sm text-ink-500 leading-relaxed">
              Начни вводить слово — мы автоматически поищем точные совпадения,
              похожие и подстрочные.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="surface p-5 sticky top-24 space-y-4 max-h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-ink-400" />
        <div className="text-sm">
          Проверка для{" "}
          <span className="font-medium text-ink-900">«{query}»</span>
        </div>
        {loading && <Spinner className="ml-auto h-3.5 w-3.5" />}
      </div>

      {check ? (
        <>
          {check.exact_match.length === 0 &&
          check.similar.length === 0 &&
          check.contains.length === 0 ? (
            <div className="rounded-2xl border border-mint-200 bg-mint-100/60 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
              Совпадений нет. Слово уникальное — можно добавлять.
            </div>
          ) : null}

          {check.exact_match.length > 0 && (
            <Section
              title="Уже есть в словаре"
              tone="lavender"
              icon={<Info className="h-4 w-4" />}
            >
              {check.exact_match.map((w) => (
                <DuplicateRow key={w.id} word={w} />
              ))}
              <p className="mt-2 text-xs text-lavender-600 leading-relaxed">
                Это подсказка: можно всё равно нажать «Создать слово» — сохранится
                твой перевод, примеры и картинка как отдельная карточка.
              </p>
            </Section>
          )}

          {check.similar.length > 0 && (
            <Section
              title="Похожие"
              tone="peach"
              icon={<Info className="h-4 w-4" />}
            >
              {check.similar.map((w) => (
                <DuplicateRow key={w.id} word={w} similarity={w.similarity} />
              ))}
            </Section>
          )}

          {check.contains.length > 0 && (
            <Section
              title="Содержат введённое"
              tone="sky"
              icon={<Info className="h-4 w-4" />}
            >
              {check.contains.map((w) => (
                <DuplicateRow key={w.id} word={w} />
              ))}
            </Section>
          )}

          {needsAck && (
            <label className="mt-2 flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-3">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => onAcknowledge(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink-300 text-ink-900 focus:ring-lavender-300"
              />
              <span className="text-sm text-ink-700 leading-relaxed">
                Я просмотрел список — всё равно добавить.
              </span>
            </label>
          )}
        </>
      ) : (
        !loading && (
          <p className="text-sm text-ink-500">Проверка временно недоступна.</p>
        )
      )}
    </aside>
  );
}

function Section({
  title,
  tone,
  icon,
  children,
}: {
  title: string;
  tone: "rose" | "peach" | "sky" | "lavender";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass = {
    rose: "border-rose2-200 bg-rose2-100/60 text-rose-700",
    peach: "border-peach-200 bg-peach-100/60 text-orange-700",
    sky: "border-sky2-200 bg-sky2-100/60 text-sky-700",
    lavender:
      "border-lavender-200 bg-lavender-100/60 text-lavender-600",
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function DuplicateRow({
  word,
  similarity,
}: {
  word: Word | WordSimilar;
  similarity?: number;
}) {
  const img = resolveImagePath(word.image_path);
  const exEn = word.example_en?.trim();
  const exRu = word.example_ru?.trim();

  return (
    <div className="rounded-xl bg-white/90 border border-white/90 shadow-soft overflow-hidden">
      <div className="flex gap-3 p-2.5">
        <div
          className={cn(
            "shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden bg-ink-100 border border-ink-200/60",
            !img && "grid place-items-center text-ink-300",
          )}
        >
          {img ? (
            <img
              src={img}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="h-7 w-7" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold text-ink-900 leading-tight truncate">
              {word.word}
            </div>
            {typeof similarity === "number" && (
              <span className="shrink-0 text-[10px] text-ink-400 tabular-nums">
                {similarity.toFixed(2)}
              </span>
            )}
          </div>
          <div className="text-xs text-ink-600 leading-snug line-clamp-2">
            {word.translation}
          </div>
          {(exEn || exRu) && (
            <div className="pt-1 space-y-1 border-t border-ink-100">
              {exEn ? (
                <p className="text-[11px] leading-snug text-ink-700 line-clamp-2">
                  <span className="label mr-1">EN</span>
                  {exEn}
                </p>
              ) : null}
              {exRu ? (
                <p className="text-[11px] leading-snug text-ink-700 line-clamp-2">
                  <span className="label mr-1">RU</span>
                  {exRu}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
