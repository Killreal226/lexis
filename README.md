# Lexis — план проекта

**Идея**: приложение для изучения английских слов. Бэкенд на Go, фронт потом.

**Источник данных**: файл из 5000 самых частотных английских слов. Поля: слово, перевод, пример-EN, картинка. Пример-RU будет добавлен скриптом с помощью нейронки.

## Структура БД (Postgres)

### Расширения

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### `words` — словарь

```sql
CREATE TABLE words (
    id           BIGSERIAL PRIMARY KEY,
    word         VARCHAR(100) NOT NULL,
    translation  VARCHAR(255) NOT NULL,
    example_en   TEXT NOT NULL,
    example_ru   TEXT,
    image_path   TEXT,                             -- NULL если картинки нет
    created_by   BIGINT REFERENCES users(id) ON DELETE CASCADE,  -- NULL = общее встроенное
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Встроенные слова (created_by IS NULL) — глобально уникальны
CREATE UNIQUE INDEX idx_words_shared_unique
    ON words(word) WHERE created_by IS NULL;

-- Пользовательские слова — уникальны в рамках одного юзера
CREATE UNIQUE INDEX idx_words_user_unique
    ON words(word, created_by) WHERE created_by IS NOT NULL;
```

- `created_by = NULL` — встроенное слово, доступно всем пользователям.
- `created_by = <user_id>` — приватное слово, видит только создатель.
- Между пользователями одинаковые приватные слова разрешены.
- Картинки — файлами на диске в `storage/images/`, в БД лежит только относительный URL (`/images/<uuid>.<ext>`). Сам путь **генерится бэкендом** при загрузке — юзер сырой путь не присылает, он прикладывает файл. Для пользовательских слов `image_path` может быть `NULL` (юзер ничего не приложил). Наружу статика раздаётся через отдельный static-хендлер на префиксе `/images/*`.

**Фильтр во всех выборках слов**:

```sql
WHERE (created_by IS NULL OR created_by = $user_id)
```

### `users` — пользователи

```sql
CREATE TABLE users (
    id             BIGSERIAL PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    is_superuser   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Пароль хранится как `bcrypt`-хеш. В Go-структуре `json:"-"` на поле пароля.

### `progress` — прогресс пользователя по слову

```sql
CREATE TABLE progress (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_id           BIGINT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    direction         VARCHAR(5) NOT NULL,           -- 'en_ru' | 'ru_en'
    level             SMALLINT NOT NULL DEFAULT 0,   -- 0..20
    last_reviewed_at  TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, word_id, direction),
    CHECK (direction IN ('en_ru', 'ru_en')),
    CHECK (level BETWEEN 0 AND 20)
);

CREATE INDEX idx_progress_user_level_reviewed
    ON progress(user_id, level, last_reviewed_at);
```

На каждое слово — **2 строки**: одна `en_ru`, вторая `ru_en`. Прогресс по направлениям независимый.

## Алгоритм обучения

### Learning (0 ≤ level < 10)

- «знаю» → `level + 1`
- «не знаю» → level не меняется, слово в конец очереди сессии
- Порядок: `ORDER BY last_reviewed_at NULLS FIRST`
- Слово, дошедшее до level=10, выпадает из learning в текущей сессии

### Review (10 ≤ level ≤ 20)

- «знаю» → `level + 1` (потолок 20)
- «не знаю» → `level − 3` (пол 10)
- Выборка по рангам в соотношении **7:3:1**:
  - `[10..13]` — плохо знаю — 70%
  - `[14..17]` — хорошо знаю — 30%
  - `[18..20]` — превосходно — 10%
- Внутри ранга: `ORDER BY last_reviewed_at NULLS FIRST`
- Опционально позже: top-N random вместо чистого FIFO, если захочется разнообразия

### Общее

- После любого ответа: `last_reviewed_at = NOW()`
- Формат ответа — самооценка (enter). Лайфхак против самообмана: мысленно проговорить ответ полностью до нажатия enter.

## UI — три режима

### 1. Учить новые слова (онбординг / инициализация)

Основной режим сортировки ещё не виденных слов. Критичен для пользователей с уже набранным словарным запасом.

Пользователь жмёт «получить слово» и для каждого слова выбирает одно из действий:

- **В корзину «учить»** — слово кладётся в локальную пачку на фронте, в БД ничего не пишется.
- **Пропустить** — слово временно отклоняется. В БД ничего не пишется.
- **Оценить рангом** — если слово уже знакомо:
  - «плохо знаю» → создаются 2 progress-строки (обе направления) с `level = 10`
  - «хорошо знаю» → `level = 14`
  - «превосходно знаю» → `level = 18`
  - Оба направления получают **одинаковый** начальный level; при несоответствии система откалибрует за пару повторений в review.

Когда пользователь завершает сессию сортировки и жмёт «учить», пачка из корзины уходит на бек и создаются 2 progress-строки на каждое слово с `level = 0`. До этого момента все данные о корзине живут только на фронте — если вкладка закрылась, ничего не потерялось в БД.

#### Состояние сессии онбординга

«В корзину» и «пропустить» **не пишут в БД**. Это значит, что с точки зрения бэка такие слова остаются «новыми» и при следующем запросе `next-candidate` могут прилететь снова. Чтобы в рамках одной сессии юзер не видел одно и то же слово повторно, фронт держит два локальных списка id:

- `cartIds` — что уже лежит в корзине «учить»;
- `skippedIds` — что пропущено в этой сессии.

При каждом запросе `GET /api/v1/learning/next-candidate` фронт передаёт объединение этих списков в query-параметре `exclude`, бэк исключает их из выборки. Списки живут только в памяти вкладки — при закрытии сбрасываются, и слово снова становится доступным для показа. Это сознательный выбор: промежуточное «скипнул в этот раз» не должно засорять БД.

Зубрёжка самой пачки (10–20 слов) идёт на фронте в случайном порядке до нажатия «учить».

### 2. Повторять learning

Все слова с `level < 10` по алгоритму learning.

### 3. Повторять всё

Слова с `level ≥ 10` по алгоритму review с соотношением рангов 7:3:1.

Режимы независимы. В коротких сессиях (метро) можно идти сразу в review, минуя learning.

## Добавление своих слов

Когда базовые 5000 выучены или просто попалось слово, которого нет в словаре — юзер может добавить своё. Приватное, видно только ему.

### Флоу

1. Юзер заполняет форму: слово, перевод, пример-EN, пример-RU (опц.). Может прикрепить **файл картинки** (опц., JPEG/PNG/WebP, до 5 МБ).
2. Перед сохранением фронт дёргает **проверку на дубликат** (`/words/check`). На этом шаге картинка не передаётся — идёт чисто JSON по введённому слову.
3. Бек возвращает три уровня от строгого к мягкому:
   - **exact match** — точное совпадение (после нормализации: `LOWER(TRIM(...))`) либо среди общих слов, либо среди своих.
   - **similar** — слова, фонетически/орфографически близкие к введённому, через `pg_trgm` с `similarity > 0.4`. Отсортированы по убыванию сходства, топ-5.
   - **contains** — слова, в которых введённое встречается как подстрока (`word ILIKE '%input%'`). Полезно, когда в БД слово хранится с пометками вроде `"get (got, gotten)"` — по `similarity` такое может не пройти порог. Отсортированы по длине слова по возрастанию, топ-10. Работает только если `len(input) >= 3` — иначе секция пустая, чтобы не выводить тысячи совпадений на коротком вводе.

   Дедупликация: каждое слово попадает **только в самую строгую секцию, в которую оно проходит**. Если слово — exact, оно не дублируется в similar/contains. Если прошло в similar, не дублируется в contains.
4. Если есть exact — форма блокирует создание, показывает «слово уже есть».
5. Если есть similar или contains — показывает их отдельными секциями («может, ты про это?» / «содержит введённое»), пользователь либо отменяет, либо подтверждает «всё равно добавить».
6. При финальном submit бек получает форму в формате `multipart/form-data` (текстовые поля + файл картинки одним запросом) и:
   - повторно проверяет exact (защита от race condition), при коллизии возвращает 409 (файл не сохраняется);
   - если картинка приложена — валидирует её (MIME по magic bytes из списка `image/jpeg`, `image/png`, `image/webp`; размер ≤ 5 МБ), генерит имя `<uuid>.<ext>` и кладёт в `storage/images/`;
   - создаёт запись с `created_by = current_user_id` и `image_path = "/images/<uuid>.<ext>"` (или `NULL` если картинки нет);
   - если `repo.Create` упал после сохранения файла — бэк удаляет файл, чтобы не оставлять orphan'ов.
7. Созданное слово попадает в **общий пул «новых слов»** и показывается в режиме «Учить новые слова» наравне с базовыми. Progress-записи автоматически **не создаются** — юзер сам решит через онбординг (в корзину / пропустить / оценить рангом).

### Пример запроса проверки

```sql
-- exact (после нормализации):
SELECT * FROM words
WHERE LOWER(TRIM(word)) = LOWER(TRIM($1))
  AND (created_by IS NULL OR created_by = $user_id);

-- fuzzy (pg_trgm similarity):
SELECT id, word, translation, similarity(word, $1) AS sim
FROM words
WHERE (created_by IS NULL OR created_by = $user_id)
  AND similarity(word, $1) > 0.4
  AND LOWER(TRIM(word)) <> LOWER(TRIM($1))       -- исключаем exact
ORDER BY sim DESC
LIMIT 5;

-- contains (подстрочное вхождение):
SELECT id, word, translation
FROM words
WHERE (created_by IS NULL OR created_by = $user_id)
  AND word ILIKE '%' || $1 || '%'
  AND LOWER(TRIM(word)) <> LOWER(TRIM($1))       -- исключаем exact
  AND similarity(word, $1) <= 0.4                -- исключаем similar
ORDER BY length(word) ASC, word ASC
LIMIT 10;
```

GIN-индекс `words USING GIN (word gin_trgm_ops)` ускоряет все три запроса — и `similarity`, и `ILIKE '%...%'`.

## Почему это работает

- **Intensive early drilling** (learning) — overlearning на ранней стадии даёт сильное долговременное удержание.
- **Асимметрия +1 / −3** отражает, что ошибка — более сильный сигнал, чем успех.
- **Пол на 10** предотвращает откат выученных слов в фазу обучения.
- **7:3:1** концентрирует внимание на сложных словах.
- **Два направления отдельно** — узнавание (EN→RU) и активное вспоминание (RU→EN) — разные навыки, трекаем независимо.
- **«Leech»-слова** саморегулируются: вылетая из learning в слабом состоянии, они оседают в ранге «плохо знаю» и получают повышенную частоту через 7:3:1.
- **Онбординг с рангами** даёт возможность быстро инициализировать большой уже знакомый словарный запас без зубрёжки очевидных слов.
- **Приватные пользовательские слова** расширяют словарь за пределы базовых 5000, с защитой от случайных дублей через `pg_trgm`.

## Архитектура бекенда

Слои: `model` → `repository` → `service` → `handler`.

- **model / repository** — делятся по сущностям (`user`, `word`, `progress`).
- **service / handler** — имя файла соответствует префиксу URL. Если за именем стоит реальный кросс-сущностный флоу (auth, learning) — оно flow-овое; если по сути это операции над одной сущностью (word) — оно entity-овое.

### Структура

```
internal/
  model/
    user.go
    word.go
    progress.go

  repository/
    user.go        Create, GetByEmail, GetByID
    word.go        Create, GetByID, ExactMatch, FindSimilar, FindContaining, ListNewForUser
    progress.go    CreateMany, GetByID, UpdateLevel, GetLearning, GetReview

  service/
    auth.go        Register, Login, Me, ParseAccessToken
    word.go        CreateWord, GetWordByID, CheckWord, ListNewWordsForUser
    learning.go    NextCandidate, Rate, BatchStart, NextProgressWithWord, SubmitAnswer

  handler/
    auth.go        /auth/*
    word.go        /words/*
    learning.go    /learning/*
```

## API

### Общее

- **Base URL**: `/api/v1`
- **Аутентификация**: JWT в заголовке `Authorization: Bearer <access_token>` (токен приходит в теле `POST /auth/register` и `POST /auth/login`). Выход: удалить токен на клиенте, опционально вызвать `POST /auth/logout` (сервер токены не хранит).
- **Успешный ответ**: голый объект или массив (без envelope).
- **Ошибки**:

```json
{ "error": "human readable message" }
```

HTTP-статусы: `400` — невалидный запрос, `401` — не авторизован, `403` — нет прав, `404` — не найдено, `409` — конфликт (дубликат), `500` — внутренняя ошибка.

### Auth

#### `POST /api/v1/auth/register`

Регистрация нового пользователя. В ответ выдаёт пользовательский объект и JWT-access-токен.

Request:

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Response `201`:

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "is_superuser": false,
    "created_at": "2026-04-21T10:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### `POST /api/v1/auth/login`

Вход по email и паролю. Возвращает того же пользователя и новый access-токен.

Request:

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Response `200`:

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "is_superuser": false,
    "created_at": "2026-04-21T10:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### `POST /api/v1/auth/logout`

Выход. Токены JWT на сервере не хранятся — после вызова клиент **удаляет** `access_token` у себя. Эндпоинт нужен для единого контракта и опциональных действий на фронте.

Request: пусто (авторизация не обязательна).

Response `204`: пусто.

#### `GET /api/v1/auth/me`

Текущий пользователь.

Response `200`:

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "is_superuser": false,
    "created_at": "2026-04-21T10:00:00Z"
  }
}
```

### Words

#### `GET /api/v1/words/:id`

Получить одно слово по ID. Должно принадлежать текущему юзеру или быть общим (`created_by IS NULL`).

Response `200`:

```json
{
  "id": 42,
  "word": "apple",
  "translation": "яблоко",
  "example_en": "I eat an apple every day.",
  "example_ru": "Я ем яблоко каждый день.",
  "image_path": "/images/apple.jpg",
  "created_by": null,
  "created_at": "2026-04-21T10:00:00Z"
}
```

#### `POST /api/v1/words/check`

Проверка дубликата перед созданием своего слова.

Request:

```json
{
  "word": "backyard"
}
```

Response `200`:

`exact_match` — **массив** всех карточек с тем же написанием слова (разные `translation` = омонимы). Так фронт видит и «sink → тонуть», и «sink → раковина», и не создаёт лишний дубликат.

```json
{
  "exact_match": [
    {
      "id": 42,
      "word": "backyard",
      "translation": "задний двор",
      "example_en": "We play in the backyard.",
      "example_ru": "Мы играем на заднем дворе.",
      "image_path": "/images/backyard.jpg",
      "created_by": null,
      "created_at": "2026-04-21T10:00:00Z"
    }
  ],
  "similar": [
    {
      "id": 234,
      "word": "back yard",
      "translation": "задний двор",
      "example_en": "The children play in the back yard.",
      "example_ru": "Дети играют на заднем дворе.",
      "image_path": "/images/back_yard.jpg",
      "created_by": null,
      "created_at": "2026-04-21T10:00:00Z",
      "similarity": 0.67
    },
    {
      "id": 1205,
      "word": "yard",
      "translation": "двор",
      "example_en": "The yard is full of leaves.",
      "example_ru": "Двор завален листьями.",
      "image_path": "/images/yard.jpg",
      "created_by": null,
      "created_at": "2026-04-21T10:00:00Z",
      "similarity": 0.45
    }
  ],
  "contains": [
    {
      "id": 892,
      "word": "backyards",
      "translation": "задние дворы",
      "example_en": "The houses have large backyards.",
      "example_ru": "У домов большие задние дворы.",
      "image_path": null,
      "created_by": null,
      "created_at": "2026-04-21T10:00:00Z"
    }
  ]
}
```

- Если точного совпадения по написанию нет — `exact_match: []`.
- Если похожих нет — `similar: []`.
- Если подстрочных вхождений нет (или `len(word) < 3`) — `contains: []`.

Элементы `similar` — полный объект слова плюс поле `similarity` (float 0..1).
Элементы `contains` — полный объект слова без дополнительных полей. Секции дедуплицированы по `id`: слово попадает только в самую строгую секцию, в которую прошло.

#### `POST /api/v1/words`

Создать приватное слово. `created_by` автоматически ставится текущим юзером.

**Content-Type**: `multipart/form-data` (не JSON — потому что форма может содержать файл).

Поля формы:

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `word` | text | да | Само слово, ≤ 100 символов. Бэк нормализует `LOWER(TRIM(...))` перед сравнением. |
| `translation` | text | да | Перевод, ≤ 255 символов. |
| `example_en` | text | да | Пример на английском. |
| `example_ru` | text | нет | Пример на русском. |
| `image` | file | нет | Файл картинки: JPEG / PNG / WebP, размер ≤ 5 МБ. |

Поле `image_path` в запросе **не принимается** — путь генерит бэк. Если клиент пришлёт его — игнорируется.

Пример запроса (псевдо):

```
POST /api/v1/words
Content-Type: multipart/form-data; boundary=...

word=backyard
translation=задний двор
example_en=We play in the backyard.
example_ru=Мы играем на заднем дворе.
image=<binary JPEG>
```

Response `201`: созданное слово (как в `GET /words/:id`) с уже проставленным `image_path`.

```json
{
  "id": 501,
  "word": "backyard",
  "translation": "задний двор",
  "example_en": "We play in the backyard.",
  "example_ru": "Мы играем на заднем дворе.",
  "image_path": "/images/8f3a2c1e-...-9b.jpg",
  "created_by": 1,
  "created_at": "2026-04-24T10:00:00Z"
}
```

Если юзер не прикладывал картинку — `image_path: null`.

Response `400` — невалидная форма (пустое `word`, слишком большой файл, неподдерживаемый MIME и т.п.):

```json
{ "error": "image file too large" }
```

Response `409` — если слово уже существует (точное совпадение). Файл, если был приложен, **не сохраняется**:

```json
{ "error": "word already exists" }
```

#### Раздача картинок

`GET /images/<filename>` — статик-хендлер отдаёт файлы из `storage/images/`. Не требует авторизации (пути непредсказуемые — UUID, без листинга директории). Картинки встроенных слов из исходного датасета импортируются тем же скриптом в ту же папку.

### Learning

#### `GET /api/v1/learning/next-candidate`

Вернуть одно слово для онбординга: такое, у которого у текущего юзера нет записи в `progress`. Если слов больше нет — `word: null`.

Query params:
- `exclude` (опциональный) — список id слов через запятую, которые нужно пропустить. Фронт передаёт сюда объединение id из корзины и скипнутых в текущей сессии, чтобы они не возвращались повторно. Пример: `?exclude=12,45,78`.

Response `200`:

```json
{
  "word": {
    "id": 42,
    "word": "apple",
    "translation": "яблоко",
    "example_en": "I eat an apple every day.",
    "example_ru": "Я ем яблоко каждый день.",
    "image_path": "/images/apple.jpg"
  }
}
```

Когда пул кандидатов исчерпан:

```json
{ "word": null }
```

#### `POST /api/v1/learning/rate`

Оценить слово в онбординге — создать 2 `progress`-строки (обе направления) с заранее заданным level.

Request:

```json
{
  "word_id": 42,
  "rank": "bad"
}
```

`rank`: `"bad"` → level=10, `"good"` → level=14, `"perfect"` → level=18.

Response `201`:

```json
{
  "level": 10
}
```

#### `POST /api/v1/learning/batch-start`

Финализация корзины «учить» из онбординга. Создаёт 2 `progress`-строки на каждое слово с `level = 0`.

Request:

```json
{
  "word_ids": [1, 5, 12, 27]
}
```

Response `201`:

```json
{
  "created_count": 8
}
```

(4 слова × 2 направления = 8 строк)

#### `GET /api/v1/learning/next`

Вернуть следующую карточку для повторения.

Query params:
- `mode` (обязательный): `learning` — выборка по `level < 10`; `review` — выборка по `level >= 10` с распределением 7:3:1.
- `direction` (обязательный): `en_ru` или `ru_en` — направление карточки. Клиент сам решает стратегию (чередовать, рандом, фиксировать одно — на его усмотрение).

Пример: `GET /api/v1/learning/next?mode=review&direction=en_ru`

Response `200`:

```json
{
  "progress_id": 321,
  "word": {
    "id": 100,
    "word": "apple",
    "translation": "яблоко",
    "example_en": "I eat an apple every day.",
    "example_ru": "Я ем яблоко каждый день.",
    "image_path": "/images/apple.jpg"
  },
  "direction": "en_ru",
  "level": 3
}
```

Когда карточек для режима больше нет:

```json
{ "progress_id": null }
```

#### `POST /api/v1/learning/answer`

Отправить ответ по карточке. Обновляет `level` и `last_reviewed_at` по правилам алгоритма.

Request:

```json
{
  "progress_id": 321,
  "known": true
}
```

Response `200`:

```json
{
  "new_level": 4,
  "graduated": false
}
```

`graduated: true` — слово перешло из фазы learning в review (пересекло границу 10).
