import { apiRequest } from "./api";
import type {
  AnswerResponse,
  AuthResponse,
  BatchStartResponse,
  CheckResponse,
  Direction,
  LearningStatsResponse,
  Mode,
  NextCandidateResponse,
  NextCardResponse,
  Rank,
  RateResponse,
  User,
  Word,
} from "./types";

const BASE = "/api/v1";

export const auth = {
  register: (email: string, password: string) =>
    apiRequest<AuthResponse>(`${BASE}/auth/register`, {
      method: "POST",
      body: { email, password },
      auth: false,
    }),
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>(`${BASE}/auth/login`, {
      method: "POST",
      body: { email, password },
      auth: false,
    }),
  me: () => apiRequest<{ user: User }>(`${BASE}/auth/me`),
  logout: () =>
    apiRequest<void>(`${BASE}/auth/logout`, { method: "POST", auth: false }),
};

export const words = {
  getById: (id: number) => apiRequest<Word>(`${BASE}/words/${id}`),
  check: (word: string) =>
    apiRequest<CheckResponse>(`${BASE}/words/check`, {
      method: "POST",
      body: { word },
    }),
  create: (form: FormData) =>
    apiRequest<Word>(`${BASE}/words`, {
      method: "POST",
      formData: form,
    }),
};

export const learning = {
  nextCandidate: (excludeIds: number[]) =>
    apiRequest<NextCandidateResponse>(`${BASE}/learning/next-candidate`, {
      query: {
        exclude: excludeIds.length ? excludeIds.join(",") : undefined,
      },
    }),
  rate: (word_id: number, rank: Rank) =>
    apiRequest<RateResponse>(`${BASE}/learning/rate`, {
      method: "POST",
      body: { word_id, rank },
    }),
  batchStart: (word_ids: number[]) =>
    apiRequest<BatchStartResponse>(`${BASE}/learning/batch-start`, {
      method: "POST",
      body: { word_ids },
    }),
  next: (mode: Mode, direction: Direction, excludeProgressIds?: number[]) =>
    apiRequest<NextCardResponse>(`${BASE}/learning/next`, {
      query: {
        mode,
        direction,
        ...(excludeProgressIds?.length
          ? { exclude: excludeProgressIds.join(",") }
          : {}),
      },
    }),
  answer: (progress_id: number, known: boolean) =>
    apiRequest<AnswerResponse>(`${BASE}/learning/answer`, {
      method: "POST",
      body: { progress_id, known },
    }),
  stats: () => apiRequest<LearningStatsResponse>(`${BASE}/learning/stats`),
};
