# Lexis Frontend

Премиум-минималистичный SPA для Lexis: онбординг новых слов, режимы learning / review,
добавление своих слов с проверкой дубликатов и загрузкой картинок.

Стек: **React 18 + TypeScript + Vite + TailwindCSS + React Router + Zustand + TanStack Query + Lucide**.

## Архитектура

```
src/
  components/
    auth/         # AuthShell + Field — общая обёртка для login/register
    layout/       # AppLayout, TopBar, ProtectedRoute
    ui/           # Spinner, EmptyState, PageHeader
    word/         # WordHero — карточка слова с картинкой и примерами
  lib/
    api.ts        # тонкий fetch-клиент с JWT и нормализацией ошибок
    endpoints.ts  # типизированные обёртки над эндпоинтами бэкенда
    types.ts      # доменные типы (User, Word, Direction, ...)
    auth-store.ts # Zustand-стор: init / login / register / logout
    cn.ts         # clsx + tailwind-merge
  pages/
    LoginPage / RegisterPage
    DashboardPage      # три режима + подсказки
    OnboardingPage     # сортировка с локальной корзиной
    SessionPage        # learning + review с flip-card и горячими клавишами
    NewWordPage        # форма + дебаунсная проверка дубликатов + аплоад
    NotFoundPage
```

## Связь с бэкендом

Фронт ходит на тот же origin (`/api/v1/*` и `/images/*`). Чтобы избежать CORS:

- **В Docker** — nginx внутри контейнера проксирует эти пути на `BACKEND_URL`.
- **В dev (vite)** — `vite.config.ts` проксирует через `VITE_BACKEND_URL`.

JWT хранится в `localStorage` под ключом `lexis.token` и подставляется
заголовком `Authorization: Bearer …` для всех запросов, кроме `register`/`login`/`logout`.

## Запуск в Docker

```bash
# Из директории frontend/
docker compose up --build
```

Откройте http://localhost:3000

Параметры:

| Переменная       | По умолчанию                          | Назначение |
| ---------------- | ------------------------------------- | ---------- |
| `FRONTEND_PORT`  | `3000`                                | Внешний порт |
| `BACKEND_URL`    | `http://host.docker.internal:8080`    | Куда nginx проксирует `/api/*` и `/images/*` |

Бэкенд должен быть запущен отдельно (на хосте на `:8080` либо в общей docker-сети).

## Локальная разработка без Docker

```bash
cd frontend
npm install
npm run dev
```

Откройте http://localhost:5173. Vite проксирует API на `http://localhost:8080`.
Чтобы поменять адрес бэкенда — задайте `VITE_BACKEND_URL`:

```bash
VITE_BACKEND_URL=http://192.168.0.10:8080 npm run dev
```

## Скрипты

- `npm run dev` — Vite dev server с HMR
- `npm run build` — продакшн-сборка в `dist/`
- `npm run preview` — локальный просмотр продакшн-сборки
