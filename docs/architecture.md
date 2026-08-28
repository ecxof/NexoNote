# Architecture

## Processes and storage tiers

```
Renderer (React + Vite)                Main process (Electron + Node)
┌────────────────────────────┐        ┌──────────────────────────────┐
│  Components (23)           │        │  electron/main.cjs           │
│                            │  IPC   │  - Window, IPC handlers      │
│  Service layer (8)         │◄──────►│  - nexopdf:// protocol       │
│   noteService              │        │  - safeStorage secrets       │
│   folderService            │        │  - spawns Python             │
│   pdfService               │        │                              │
│   settingsService          │        │  electron/database.cjs       │
│   flashcardService         │        │  - SQLite schema + CRUD      │
│   semanticLinkingService   │        │  - JSON to SQLite migration  │
│   chatService              │        │                              │
│   secretService            │        │  electron/preload.cjs        │
│                            │        │  - contextBridge API         │
│  apiClient.js  ────────────┼─HTTP──►│  electron/python-env.cjs     │
│                            │        │  - interpreter probing       │
│  localStorage fallback     │        └──────────────┬───────────────┘
└────────────────────────────┘                       │ spawn
             │                                       ▼
             │ HTTP                       ┌────────────────────────┐
             └──────────────────────────► │  server/api (FastAPI)  │
                                          │  :8765                 │
                                          ├────────────────────────┤
                                          │  server/semantic       │
                                          │  CLI, or Flask :5000   │
                                          └────────────────────────┘
                                                     │
                                              nexonote.db (SQLite)
```

### Storage routing

Every data service resolves its backend at call time, in this order:

1. **FastAPI over HTTP** — if Electron started the Python backend, it serves the API
   on `http://127.0.0.1:8765` and the renderer talks to it over HTTP
2. **Electron IPC** — otherwise the renderer uses `window.electronAPI`, reaching
   `electron/database.cjs` and `better-sqlite3` directly
3. **localStorage** — in a plain browser with no Electron present

Tiers 1 and 2 are two independent implementations of one contract, over the same
SQLite file. `src/shared/api/apiClient.js` deliberately mirrors the shape of `window.electronAPI`
so a service can swap between them without branching per-method. See
[backend-api-contract.md](./backend-api-contract.md) for the contract itself.

> [!NOTE]
> Keeping two implementations in sync is the main maintenance cost in this codebase.
> A change to one tier that is not mirrored in the other produces a bug that appears
> only in one run mode. The recipe in [development.md](./development.md) walks all
> three tiers for this reason.

### Secret storage is separate

The Hugging Face token does **not** go through the settings path. Settings have three
writers and only Electron can reach the OS keystore, so a token stored there would be
written in the clear whenever the Python backend was active. Instead the main process
encrypts it with Electron's `safeStorage` (DPAPI on Windows, Keychain on macOS) behind
a dedicated `secrets:*` IPC channel. In a plain browser no storage is offered at all,
and the assistant falls back to the `VITE_HF_API_TOKEN` build-time variable.

## View router

`MainContent.jsx` switches on a single `view` string held in `App.jsx`:

| `view` | Renders |
| --- | --- |
| `dashboard` | Dashboard — greeting, create/import actions, flashcard hero, recent notes |
| `folder` | FolderView — breadcrumb, search, sort, grid/list, note + PDF cards |
| `editor` | Workspace layout — TabBar + NoteEditor or PDFViewer, flanked by both sidebars |
| `settings` | Settings — auto-save, font size, theme, AI token |
| `flashcards` | FlashcardsView — card library |
| `flashcard-review` | FlashcardReviewSession — SM-2 review run |
| `performance-analytics` | PerformanceAnalyticsView — review history charts |
| `semantic-map` | SemanticGraphView — force-directed note graph |

## Component hierarchy

```
App.jsx  (global state, data handlers)
├── ItemMenuProvider          context: only one three-dot menu open at a time
├── ConfirmModal / PromptModal
├── Sidebar                   resizable 200-480px, collapsible to 56px
│   └── SidebarTree           recursive folders, notes, PDFs, each with a menu
└── MainContent               view router (table above)
    └── view="editor" → WorkspaceLayout
        ├── NoteViewSidebar         tags, contents outline, Related notes
        ├── TabBar
        ├── NoteEditor → RichTextEditor    TipTap + main and floating toolbars
        │   └── SemanticLink extension     keyword highlight marks
        ├── PDFViewer → PDFFloatingToolbar
        └── NoteViewRightSidebar    AI assistant chat, flashcards, export
```

## Renderer layout

`src/` is sliced by feature, not by file type. A feature directory owns its
components, its data service, and its stylesheet together, so adding or deleting
a feature touches one directory.

```
src/
├── app/         Shell: App, view router, sidebar, tab bar (+ their CSS)
├── features/    dashboard, folders, notes, assistant, semantic, pdfs,
│                flashcards, settings - each with components + service + CSS
├── shared/      api/ (HTTP client), components/ (ItemMenu, Modal), context/
├── styles/      main.css barrel, tokens.css, base.css
└── main.jsx     Entry point
```

Import rule: crossing a directory uses the `@/` alias, staying inside one keeps
`./`. Cross-feature imports are allowed and expected — `NoteViewSidebar` in
`notes/` calls the linking service in `semantic/`, and `RichTextEditor` uses the
`SemanticLink` mark from the same place.

## Data model

### SQLite tables

| Table | Purpose |
| --- | --- |
| `folders` | Nested folders, self-referential via `parent_id` |
| `notes` | Title, HTML content, folder, timestamps |
| `tags` | Unique tag names |
| `note_tags` | Note-to-tag join table |
| `pdfs` | Title, file path, folder, timestamps |
| `settings` | Key-value app settings |
| `flashcard_decks` | Deck grouping |
| `flashcards` | Card content, type, status, SM-2 scheduling state |
| `flashcard_options` | Multiple-choice options with a correctness flag |
| `review_history` | One row per review, backing the analytics view |

### Relationships

- `Note.folderId` to `Folder.id` (nullable; null means uncategorized)
- `PDF.folderId` to `Folder.id` (nullable)
- `Folder.parentId` to `Folder.id` (self-referential; move cycles are rejected)
- Note to Tag, many-to-many through `note_tags`
- On folder delete: subfolders are re-parented, notes and PDFs move to "All"

### SM-2 scheduling

Flashcards carry `easiness_factor` (default 2.5), `interval_days`, and
`repetition_count`. Scheduling lives in two places that must agree —
`electron/database.cjs` for the IPC tier and `server/api/flashcard_logic.py` for the
FastAPI tier.

## State management

All global state lives in `App.jsx` and is passed down as props. There is no store
library.

| State | Purpose |
| --- | --- |
| `notes`, `folders`, `pdfs` | Loaded entity collections |
| `tabs`, `activeTabId` | Open-file tab strip |
| `view` | Active view (see router table) |
| `currentNoteId`, `selectedFolderId` | Selection for editor and folder views |
| `settings` | App settings, hydrated on mount |
| `copiedNoteId`, `copiedPdfId` | Copy/paste clipboard |
| `modal` | Active confirm/prompt modal config |
| `noteViewSidebarOpen`, `noteViewRightSidebarOpen` | Note view sidebar visibility |
| `flashcardLibraryVersion` | Counter that forces a flashcard library refetch |
| `reviewSessionConfig` | Parameters for an in-progress review session |

## Python integration

The interpreter is never hardcoded. `electron/python-env.cjs` probes candidates in
order and keeps the first that can import the required packages: an explicit
`NEXONOTE_*_PYTHON` env var, then the project-local `.venv`, then `py -3` / `python3`,
then `python`. If none qualify, the error names every candidate and why each failed.

Semantic linking reaches Python two different ways depending on run mode: Electron
spawns `server/semantic/cli.py` per request over stdin/stdout JSON, while browser dev
posts to the Flask server on `:5000`. See [semantic-linking.md](./semantic-linking.md).

## Performance notes

- `better-sqlite3` is synchronous — no async overhead, and fine for a single window
- WAL journal mode for concurrent reads
- The service layer caches nothing; every call reads through to storage
- Styles are 14 stylesheets assembled by one barrel, `src/styles/main.css`, which is
  the only CSS `App.jsx` imports. Twelve sit beside the code they style (three in
  `app/`, nine across `features/`); the other two are global — `tokens.css` for the
  variables and `base.css` for shared primitives. Vite inlines the `@import`s at build
  time, so there is no runtime request waterfall
- TipTap is the heaviest component; content is stored as HTML
- PDFs are streamed through the custom `nexopdf://` protocol in Electron rather than
  inlined as base64 data URLs
- Tab switching preserves component state through conditional rendering

## Known structural debt

- **Duplicated data layer** — `electron/database.cjs` (~1,300 lines) and
  `server/api/db.py` plus its routers (~1,000 lines) implement the same contract twice,
  with `src/shared/api/apiClient.js` mirroring the surface a third time
- **Unused legacy components** — `src/features/folders/FolderList.jsx` and
  `src/features/notes/NoteList.jsx` are exported but imported nowhere; both are
  superseded by `src/app/SidebarTree.jsx`
