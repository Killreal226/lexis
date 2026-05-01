export type User = {
  id: number;
  email: string;
  is_superuser: boolean;
  created_at: string;
};

export type Word = {
  id: number;
  word: string;
  translation: string;
  example_en: string;
  example_ru?: string | null;
  image_path?: string | null;
  created_by?: number | null;
  created_at?: string;
};

export type WordSimilar = Word & { similarity: number };

export type CheckResponse = {
  exact_match: Word[];
  similar: WordSimilar[];
  contains: Word[];
};

export type Direction = "en_ru" | "ru_en";
export type Mode = "learning" | "review";
export type Rank = "bad" | "good" | "perfect";

export type NextCandidateResponse = { word: Word | null };

export type RateResponse = { level: number };

export type BatchStartResponse = { created_count: number };

export type NextCardResponse =
  | {
      progress_id: number;
      word: Word;
      direction: Direction;
      level: number;
    }
  | { progress_id: null };

export type AnswerResponse = {
  new_level: number;
  graduated: boolean;
};

export type LearningBucketStats = {
  new: number;
  in_progress: number;
  bad: number;
  good: number;
  perfect: number;
  total: number;
};

export type LearningStatsResponse = {
  en_ru: LearningBucketStats;
  ru_en: LearningBucketStats;
  total: LearningBucketStats;
};

export type AuthResponse = {
  user: User;
  access_token: string;
};

/**
 * Бэкенд может присылать image_path и в виде абсолютного пути ("/images/x.jpg"),
 * и в виде относительного ("images/x.jpg" — встречается в сидах).
 * Этот хелпер приводит к абсолютной форме относительно origin фронта,
 * чтобы <img src> не клеился к текущему пути роута.
 */
export function resolveImagePath(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? path : `/${path}`;
}
