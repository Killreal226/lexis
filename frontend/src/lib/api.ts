/**
 * Тонкая обёртка над fetch:
 *  - подставляет JWT из localStorage,
 *  - парсит JSON и нормализует ошибки в ApiError,
 *  - не имеет глобального base URL — все пути идут на тот же origin
 *    (в Docker — через nginx-proxy на бэкенд, в dev — через Vite proxy).
 */

const TOKEN_KEY = "lexis.token";

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined | null>;
  auth?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  if (!query) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, formData, signal, query, auth = true } = opts;

  const headers: Record<string, string> = {};
  if (auth) {
    const token = tokenStorage.get();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: payload,
    signal,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ||
      (typeof data === "string" ? data : null) ||
      response.statusText ||
      "Запрос не удался";

    if (response.status === 401) {
      tokenStorage.clear();
    }

    throw new ApiError(response.status, message, data);
  }

  return data as T;
}
