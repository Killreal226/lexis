import type { Word } from "./types";

/**
 * Передаёт корзину между OnboardingPage и DrillPage.
 *
 * sessionStorage, а не in-memory: чтобы переживать F5 и переключение вкладок.
 * Очищается, когда пользователь явно завершает зубрёжку.
 */
const KEY = "lexis.drill.cart.v1";

type DrillPayload = {
  words: Word[];
  startedAt: string;
};

export const drillStorage = {
  set(words: Word[]) {
    const payload: DrillPayload = {
      words,
      startedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  },
  get(): DrillPayload | null {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as DrillPayload;
      if (!parsed?.words?.length) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  clear() {
    sessionStorage.removeItem(KEY);
  },
};
