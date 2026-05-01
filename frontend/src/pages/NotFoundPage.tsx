import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-full app-shell-bg flex items-center justify-center px-4 py-20">
      <div className="surface text-center p-12 max-w-md animate-scale-in">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-lavender-100 to-peach-100 text-lavender-500">
          <Compass className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          404
        </h1>
        <p className="mt-2 text-ink-500">
          Здесь ничего нет. Может, вернёмся на главную?
        </p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          На главную
        </Link>
      </div>
    </div>
  );
}
