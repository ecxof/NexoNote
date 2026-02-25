# NexoNote Backend API Contract

This document defines the HTTP API contract that the Python backend must implement. It is derived from the current Electron IPC API in `electron/main.cjs`, `electron/preload.cjs`, and `electron/database.cjs`. All JSON request/response bodies use **camelCase** for field names. Date fields are ISO 8601 strings.

**Base path**: `/api` (e.g. `GET /api/notes`).

**Health**: `GET /health` or `GET /api/health` → 200 when DB is ready.

---

## 1. Notes

### GET /api/notes
- **Response**: `200 OK`, body: array of Note objects.
- **Note shape**:
  - `id` (string, UUID)
  - `title` (string)
  - `content` (string, HTML)
  - `folderId` (string | null)
  - `tags` (array of strings)
  - `createdAt` (string, ISO date)
  - `updatedAt` (string, ISO date)

### GET /api/notes/:id
- **Response**: `200 OK` with single Note, or `404` if not found.

### POST /api/notes
- **Body**: `{ "folderId": string | null }` (optional, default null).
- **Response**: `201` with created Note (same shape). Server generates `id` (UUID).

### PUT /api/notes/:id
- **Body**: partial `{ "title"?: string, "content"?: string, "folderId"?: string | null, "tags"?: string[] }`.
- **Response**: `200` with updated Note, or `404` if not found.

### DELETE /api/notes/:id
- **Response**: `200` with body `{ "ok": true }` or `{ "ok": false }` (boolean success). Cascades: remove note_tags, remove flashcards for this note.

---

## 2. Folders

### GET /api/folders
- **Response**: `200 OK`, body: array of Folder objects.
- **Folder shape**:
  - `id` (string, UUID)
  - `name` (string)
  - `parentId` (string | null)
  - `createdAt` (string, ISO date)

### POST /api/folders
- **Body**: `{ "name": string, "parentId"?: string | null }`.
- **Response**: `201` with created Folder. Server generates `id` (UUID).

### PUT /api/folders/:id
- **Body**: partial `{ "name"?: string, "parentId"?: string | null }`.
- **Response**: `200` with updated Folder, or `404` if not found.

### DELETE /api/folders/:id
- **Response**: `200` with body `{ "ok": true }` or `{ "ok": false }`. Side effects: re-parent child folders to this folder’s parent; set `folderId` to null for notes and pdfs in this folder; then delete folder.

---

## 3. PDFs

### GET /api/pdfs
- **Response**: `200 OK`, body: array of Pdf objects.
- **Pdf shape**:
  - `id` (string, UUID)
  - `type` (literal `"pdf"`)
  - `title` (string)
  - `filePath` (string, data URL or path)
  - `folderId` (string | null)
  - `createdAt` (string, ISO date)
  - `updatedAt` (string, ISO date)

### GET /api/pdfs/:id
- **Response**: `200 OK` with single Pdf, or `404` if not found.

### POST /api/pdfs
- **Body**: `{ "filePath": string, "title": string, "folderId"?: string | null }`.
- **Response**: `201` with created Pdf. Server generates `id` (UUID).

### PUT /api/pdfs/:id
- **Body**: partial `{ "title"?: string, "folderId"?: string | null }`.
- **Response**: `200` with updated Pdf, or `404` if not found.

### DELETE /api/pdfs/:id
- **Response**: `200` with body `{ "ok": true }` or `{ "ok": false }`.

---

## 4. Settings

### GET /api/settings
- **Response**: `200 OK`, body: single object with arbitrary keys (e.g. `autoSave`, `fontSize`, `theme`, `sidebarWidth`, `sidebarCollapsed`). Values are JSON-typed (boolean, number, string, etc.).

### PUT /api/settings (or POST)
- **Body**: partial object of key-value pairs to upsert (e.g. `{ "autoSave": true, "theme": "dark" }`).
- **Response**: `200` with full settings object (same as GET /api/settings).

---

## 5. Flashcards

### GET /api/flashcards
- **Query params** (all optional): `status`, `type`, `noteId`, `topicId`, `dueOnly`, `now` (ISO string).
- **Response**: `200 OK`, body: array of Flashcard objects (see Flashcard shape below). Each item may include `noteTitle`, `deckTitle`, `sourceNoteId` when returned from list endpoints.

### GET /api/flashcards/library
- **Response**: `200 OK`, body: array of `{ "noteId": string, "title": string, "tags": string[], "totalCards": number, "dueToday": number }`.

### GET /api/flashcards/:id
- **Response**: `200 OK` with single Flashcard (with `options` for MCQ), or `404` if not found.

### POST /api/flashcards
- **Body**: Flashcard create payload:
  - `noteId` or `sourceNoteId` (string, required)
  - `type` ("flip" | "mcq" | "true_false")
  - `questionText` or `prompt` (string)
  - `answerText` or `back` (string)
  - `options` (array of `{ "text": string, "isCorrect": boolean, "order"?: number }`) for MCQ
  - `correctOptionIndex` (number) for MCQ
  - `correctAnswer` (boolean) for true_false
  - `status` ("DRAFT" | "SAVED")
  - `topicId`, `explanation` / `explanationText`, `easinessFactor`, `intervalDays`, `repetitionCount`, `lastReviewDate`, `nextReviewDate` (optional).
- **Response**: `201` with created Flashcard (full shape). Server may create/link a deck per note internally.

### PUT /api/flashcards/:id
- **Body**: partial Flashcard fields (same as create, partial updates).
- **Response**: `200` with updated Flashcard, or `404` if not found.

### DELETE /api/flashcards/:id
- **Response**: `200` with body `{ "ok": true }` or `{ "ok": false }`.

### GET /api/flashcards/due
- **Query params** (optional): `noteId`, `topicId`, `type`, `now`, `limit` (default 100).
- **Response**: `200 OK`, body: array of Flashcard objects (due cards only, with `noteTitle`, `deckTitle`, `sourceNoteId`).

### POST /api/flashcards/:id/review
- **Body**: `{ "rating": number (0–5), "reviewedAt"?: string (ISO), "reviewMeta"?: { "result"?: string, "difficulty"?: string, "responseTimeMs"?: number } }`.
- **Response**: `200` with `{ "flashcard": Flashcard, "scheduling": Scheduling }`.
- **Scheduling shape**: `{ "previousEf", "previousInterval", "previousRepetition", "nextEf", "nextInterval", "nextRepetition", "nextReviewDate", "rating" }` (numbers and ISO date string).

### GET /api/flashcards/analytics
- **Query params** (optional): `days` (default 30), `now` (ISO string).
- **Response**: `200 OK`, body:
  - `windowDays` (number)
  - `startDate`, `endDate` (ISO strings)
  - `topics` (array of `{ "topicId", "topicName", "totalReviews", "correctReviews", "masteryPercent", "category", "noData" }`)
  - `weakTopics` (array, same shape, filtered and sorted)

**Flashcard shape** (camelCase):
- `id`, `deckId`, `deckTitle`, `sourceNoteId`, `noteId`, `topicId`
- `prompt`, `back`, `questionText`, `answerText`
- `correctAnswer` (boolean | null for true_false)
- `correctOptionIndex` (number | null for mcq), `correctOptionText` (string | null for mcq)
- `explanationText` (string)
- `type` ("flip" | "mcq" | "true_false"), `status` ("DRAFT" | "SAVED")
- `easinessFactor`, `intervalDays`, `repetitionCount`
- `lastReviewDate`, `nextReviewDate` (string | null)
- `createdAt`, `updatedAt` (ISO strings)
- `options` (array of `{ "id", "text", "isCorrect", "order" }` for MCQ only)

---

## Errors

- **4xx/5xx**: Prefer JSON body e.g. `{ "error": "message" }`. Frontend will map these to thrown errors so callers behave like IPC failures.
- **404**: Use for getById-style endpoints when resource is missing.

---

## Optional (future)

- **POST /api/pdfs/export**: Accept pdf id + highlights; return `{ "folderPath" }` or similar (or leave to Electron for file dialog). Not required for initial migration.
