# NexoNote - Desktop Study Application

> A modern desktop note-taking application built with React, Electron, and SQLite. Rich text editing, PDF support, flashcards with spaced repetition, semantic linking, and offline-first storage.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Status](https://img.shields.io/badge/status-Active%20Development-green)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

## Overview

NexoNote is a desktop note-taking and study companion built with Electron and React. It supports rich text editing, PDF import/viewing, folder-based organization, flashcard review, and local-only storage.

### Key Features

- **Rich Text Editor** - Full formatting: bold, italic, headings, lists, highlights, images, links, code blocks
- **File & Folder Management** - Nested folders, rename, copy, move, delete for notes and PDFs
- **PDF Support** - Import, view, and manage PDF files alongside notes. In Electron, PDFs are streamed through a custom `nexopdf://` protocol
- **Tags** - Tag notes with autocomplete suggestions and inline editing
- **Tab Bar** - Open multiple notes and PDFs in browser-style tabs
- **Flashcards** - Flip, multiple-choice, and true/false cards scheduled with the SM-2 spaced-repetition algorithm, plus review sessions and performance analytics
- **Semantic Linking** - Related notes (TF-IDF), in-editor keyword highlights, and a force-directed semantic graph. See [semantic_linking/README.md](semantic_linking/README.md) for setup
- **AI Assistant** - In-note chat with Explain This, Summarize, and Quiz Me, backed by Hugging Face. The API token is entered in Settings, so no rebuild is needed
- **Local Storage** - SQLite in Electron, `localStorage` in the browser. See [Storage](#storage) below
- **Dark & Light Themes** - Configurable via Settings, applies instantly
- **Offline-First** - All note data is stored locally. Only the optional AI assistant requires a network connection

---

## Quick Start

### Prerequisites

**Required**

- **Node.js 22.12+** - Vite 7 requires `^20.19.0 || >=22.12.0` and Electron 42 requires `>=22.12.0`, so 22.12 is the effective floor. Node 18 will not build this project
- **npm 10+**

**Required for Electron mode only**

- A native build toolchain, so `better-sqlite3` can be compiled against Electron's ABI:
  - **Windows** - Visual Studio Build Tools with the "Desktop development with C++" workload
  - **macOS** - Xcode Command Line Tools (`xcode-select --install`)
  - **Linux** - `build-essential` and `python3`

  Without it, `npm install` fails at the `postinstall` rebuild step. Browser mode (`npm run dev`) is unaffected.

**Optional**

- **Python 3.9+** - Required for semantic linking and for the FastAPI backend. Without Python, the app still runs; semantic linking is simply unavailable and Electron falls back to its built-in Node/SQLite backend

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd NexoNote

# Install dependencies
npm install

# Start development server (browser; notes stored in localStorage)
npm run dev

# Or run as Electron desktop app (notes stored in SQLite)
npm run electron:dev
```

- **Browser:** Visit `http://127.0.0.1:5173` (or the port Vite prints). Notes and settings use `localStorage`.
- **Electron:** Runs the same React app in a window; notes and settings are stored in a SQLite database (`nexonote.db`) under the app's user data directory. Legacy JSON data files are migrated to SQLite automatically on first launch.

### Optional Python setup

```bash
# Semantic linking (TF-IDF related notes + graph)
pip install -r semantic_linking/requirements.txt
python -m nltk.downloader punkt stopwords wordnet

# FastAPI backend (alternative to the built-in Node/SQLite backend)
pip install -r backend/requirements.txt
```

### AI assistant setup

Open **Settings > AI Assistant** and paste your
[Hugging Face token](https://huggingface.co/settings/tokens). It is saved with the rest
of your settings and takes effect immediately, with no rebuild.

Alternatively, for development, set it at build time:

```bash
cp .env.example .env
```

Then set `VITE_HF_API_TOKEN` in `.env`. Settings take precedence; the environment
variable is used only when the Settings field is empty. Note that Vite inlines this
variable when the bundle is built, so a packaged app cannot pick up a new value from
`.env`; use the Settings field for installed builds.

Requests are proxied through Vite to `https://router.huggingface.co`. Without a token
the rest of the app works normally and only the AI assistant is unavailable.

> [!NOTE]
> The token is stored in plain text alongside your other settings (SQLite in Electron,
> `localStorage` in the browser) and is sent only to Hugging Face.

---

## Storage

Every data service resolves its backend at call time, in this order:

1. **FastAPI over HTTP** - If Electron successfully started the Python backend, it serves the API on `http://127.0.0.1:8765` and the renderer talks to it over HTTP
2. **Electron IPC** - Otherwise the renderer uses `window.electronAPI`, which reaches `electron/database.cjs` and `better-sqlite3` directly
3. **localStorage** - In a plain browser with no Electron present

Tiers 1 and 2 are two implementations of the same contract and share the same SQLite database file. See [docs/backend-api-contract.md](./docs/backend-api-contract.md) for the API shape.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | React 19 | Components and state |
| Build Tool | Vite 7.x | Fast HMR dev server |
| Desktop Shell | Electron 42.x | Native window, file system, IPC |
| Rich Text Editor | TipTap 3.x (ProseMirror) | Note content editing |
| Database | better-sqlite3 12.x | Local storage (Electron mode) |
| Backend (optional) | FastAPI + Uvicorn | HTTP implementation of the same data API |
| Semantic Linking | scikit-learn + NLTK | TF-IDF and cosine similarity |
| Graph Rendering | react-force-graph-2d | Force-directed semantic graph |
| Packaging | electron-builder | Installer builds |
| Icons | Lucide React | UI iconography |
| IDs | nanoid | Unique identifiers |
| Styling | CSS Variables + Flexbox + Grid | Theming and layout |

---

## Project Structure

```
NexoNote/
├── .github/
│   └── workflows/
│       ├── ci.yml               # CI: lint + build on push/PR
│       ├── codeql.yml           # CodeQL security analysis
│       └── npm-audit.yml        # Dependency vulnerability scan
├── backend/                     # Optional FastAPI backend (Python)
│   ├── main.py                  # App, CORS, router registration
│   ├── db.py                    # SQLite schema + row mapping
│   ├── flashcard_logic.py       # SM-2 scheduling
│   └── routers/                 # notes, folders, pdfs, settings, flashcards
├── semantic_linking/            # TF-IDF related-notes engine (Python)
│   ├── pipeline.py              # HTML strip, tokenize, TF-IDF, cosine similarity
│   ├── cli.py                   # stdin/stdout JSON transport (Electron)
│   └── server.py                # Flask server on :5000 (browser dev)
├── electron/
│   ├── main.cjs                 # Main process, IPC handlers, nexopdf:// protocol
│   ├── preload.cjs              # contextBridge API
│   ├── database.cjs             # SQLite schema, CRUD, JSON migration
│   └── test-database.cjs        # Database smoke tests
├── src/
│   ├── components/              # 23 React components
│   │   ├── Dashboard.jsx        # Home view
│   │   ├── RichTextEditor.jsx   # TipTap editor + toolbars
│   │   ├── NoteEditor.jsx       # Note editing wrapper
│   │   ├── PDFViewer.jsx        # PDF viewer
│   │   ├── Sidebar.jsx          # Main nav sidebar
│   │   ├── SidebarTree.jsx      # Folder/note/PDF tree
│   │   ├── TabBar.jsx           # Open file tabs
│   │   ├── FolderView.jsx       # Folder contents
│   │   ├── FlashcardsView.jsx   # Flashcard library
│   │   ├── SemanticGraphView.jsx # Force-directed note graph
│   │   ├── Settings.jsx         # App settings
│   │   └── ...                  # (see COMPLETE_FILE_LISTING.md)
│   ├── services/                # Data access layer (7 files)
│   │   ├── noteService.js       # Note CRUD
│   │   ├── folderService.js     # Folder CRUD
│   │   ├── pdfService.js        # PDF CRUD
│   │   ├── settingsService.js   # Settings read/write
│   │   ├── flashcardService.js  # Flashcard CRUD + review
│   │   ├── semanticLinkingService.js # Related-notes requests
│   │   └── chatService.js       # Hugging Face streaming chat
│   ├── context/
│   │   ├── ItemMenuContext.jsx  # Single-open menu context
│   │   └── ItemMenuProvider.jsx # Provider (split out for Fast Refresh)
│   ├── extensions/
│   │   └── SemanticLink.js      # TipTap mark for keyword links
│   ├── apiClient.js             # HTTP client mirroring the electronAPI shape
│   ├── App.jsx                  # Root component + global state
│   ├── App.css                  # Component styles
│   ├── index.css                # CSS variables + themes
│   └── main.jsx                 # Entry point
├── docs/
│   └── backend-api-contract.md  # Shared API contract (IPC and HTTP)
├── public/                      # Static assets + logo
└── package.json
```

---

## Design System

### Color Palette (Dark Mode)

| Variable | Color | Usage |
|----------|-------|-------|
| `--bg-primary` | `#0f172a` | Main background |
| `--bg-secondary` | `#111827` | Content backgrounds |
| `--bg-sidebar` | `#13161C` | Sidebar background |
| `--accent-primary` | `#2563EB` | Buttons, highlights |
| `--text-primary` | `#ffffff` | Headings |
| `--text-secondary` | `#9ca3af` | Body text |
| `--text-tertiary` | `#6b7280` | Subtle text |
| `--border-color` | `#1f2937` | Borders |

### Layout

- **Sidebar**: Drag-resizable, default 280px, clamped between 200px and 480px. The width is persisted to settings, and the sidebar can be collapsed
- **Main Content**: Flex-grow, scrollable
- **Dashboard Grid**: `repeat(auto-fit, minmax(300px, 1fr))`, so the column count follows the available width rather than fixed breakpoints
- **Responsive breakpoints**: layout adjustments are defined at `max-width: 1100px`, `max-width: 900px`, and `max-width: 840px` in `App.css`

---

## Available Scripts

```bash
# Development (browser, uses localStorage)
npm run dev

# Development (Electron desktop app, uses SQLite)
npm run electron:dev

# Production build (renderer only)
npm run build

# Package the desktop app (installer in release/)
npm run dist

# Package without creating an installer (unpacked dir, faster)
npm run dist:dir

# Rebuild native modules for Electron
npm run rebuild

# Code quality
npm run lint
```

---

## Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Get started in 5 minutes
- **[PROJECT_SETUP.md](./PROJECT_SETUP.md)** - Complete setup guide
- **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** - Step-by-step setup verification
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design
- **[SEMANTIC_LINKING.md](./SEMANTIC_LINKING.md)** - Semantic linking design and setup
- **[docs/backend-api-contract.md](./docs/backend-api-contract.md)** - Shared data API contract
- **[STYLING_GUIDELINES.md](./STYLING_GUIDELINES.md)** - CSS best practices
- **[COLOR_AND_STYLE_REFERENCE.md](./COLOR_AND_STYLE_REFERENCE.md)** - Full color and style reference
- **[DEVELOPER_CHECKLIST.md](./DEVELOPER_CHECKLIST.md)** - Pre-commit developer checklist
- **[COMPLETE_FILE_LISTING.md](./COMPLETE_FILE_LISTING.md)** - Full file inventory

---

## Application Views

### Dashboard (Home)

- Greeting header with "Create New Note" and "Import PDF" buttons
- Flashcard hero card
- Recent notes grid with tags, file path, and timestamps

### Note Editor

- Editable title and rich text body (TipTap)
- Full toolbar: undo/redo, headings, bold, italic, strikethrough, underline, highlight (split-button with color picker), lists, alignment, links, images, code blocks
- Floating contextual toolbar on text selection
- Left sidebar: tags, contents outline, semantic graph
- Right sidebar: AI assistant, flashcards, export

### Folder View

- Breadcrumb navigation, search bar, sort control
- Grid/list view toggle
- Folder, note, and PDF cards with three-dot menus

### Flashcards

- Library of flip, multiple-choice, and true/false cards
- Review sessions scheduled by SM-2, with Again/Hard/Good/Easy ratings
- Performance analytics over recorded review history

### Settings

- Auto-save toggle, font size selector, dark/light theme toggle
- Hugging Face API token for the AI assistant, with show/hide

---

## Features

### Implemented

- [x] Rich text editor (TipTap): bold, italic, underline, strikethrough, headings (H1-H4), bullet/ordered/task lists, blockquote, code/code block, highlight (multi-color), links, images, text alignment, sub/superscript
- [x] Floating contextual toolbar on text selection
- [x] Full file/folder CRUD (create, rename, copy, move, delete)
- [x] Nested folder hierarchy, guarded against move cycles
- [x] PDF import, inline viewing, and file management
- [x] Tab bar for multi-file editing
- [x] Tags system with autocomplete and inline editing
- [x] Dark and light theme support (instant toggle)
- [x] Settings panel (auto-save, font size, theme)
- [x] Resizable and collapsible sidebars (main, note-left, note-right)
- [x] SQLite storage backend (Electron mode)
- [x] Optional FastAPI backend over HTTP
- [x] localStorage fallback (browser dev mode)
- [x] Note export to PDF (via print)
- [x] Custom modals (confirm, prompt) replacing browser dialogs
- [x] Breadcrumb navigation in folder view and note view
- [x] Flashcards with SM-2 spaced repetition (flip, MCQ, true/false)
- [x] Flashcard performance analytics
- [x] Semantic linking (TF-IDF related notes + force-directed graph)
- [x] AI assistant with streaming responses (Hugging Face), token configurable in Settings
- [x] Electron packaging via electron-builder (`npm run dist`)

### Upcoming

- [ ] Auto-update support
- [ ] Full-text search (SQLite FTS5)
- [ ] Study pattern analysis and personalized recommendations

---

## Development Guide

### Adding a New Component

1. Create component file in `src/components/YourComponent.jsx`
2. Add styles to `src/App.css`
3. Import and use in parent component
4. Use CSS variables for colors
5. Ensure dark theme compatibility

### Styling Best Practices

- Always use CSS variables from `index.css`
- Use Flexbox for layouts
- Add hover states for interactive elements
- Maintain dark theme consistency
- Use semantic HTML

See [STYLING_GUIDELINES.md](./STYLING_GUIDELINES.md) for detailed guidance.

---

## Deployment

### Build for Production (Web)

```bash
npm run build
```

Creates an optimized build in the `dist/` directory.

### Electron Desktop App

```bash
# Development
npm run electron:dev

# Package an installer (output in release/)
npm run dist

# If better-sqlite3 fails to load, rebuild native modules:
npm run rebuild
```

Packaging requires the native build toolchain listed under [Prerequisites](#prerequisites), because `better-sqlite3` is compiled against Electron's ABI during `postinstall`.

---

## Contributing

Contributions are welcome. Please ensure:

1. Code follows the style guide in STYLING_GUIDELINES.md
2. All components are dark-theme compatible
3. Responsive design is tested
4. Documentation is updated
5. `npm run lint` passes (CI enforces this)

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## Roadmap

### Phase 1: Core Note Editor (complete)

- Rich text editor with full formatting
- File/folder management with CRUD
- Settings panel
- Dark/light themes

### Phase 2: PDF & Storage (complete)

- PDF import, viewing, file management
- Tab bar for multi-file workspace
- SQLite database backend
- JSON-to-SQLite migration

### Phase 3: Intelligence (complete)

- Semantic graph / knowledge linking
- AI-assisted "Explain This" for selected text
- Flashcard generation and review

### Phase 4: Distribution (in progress)

- Electron packaging (installer builds) - complete
- Auto-update support
- Performance optimization

### Phase 5: Analytics (in progress)

- Python backend integration - complete
- Flashcard performance analytics - complete
- Study pattern analysis and personalized recommendations

---

## Built With

- [React](https://react.dev) - UI Framework
- [Vite](https://vitejs.dev) - Build Tool
- [Electron](https://www.electronjs.org/) - Desktop Shell
- [SQLite](https://www.sqlite.org/) (better-sqlite3) - Database
- [TipTap](https://tiptap.dev) - Rich Text Editor
- [FastAPI](https://fastapi.tiangolo.com/) - Optional Python backend
- [scikit-learn](https://scikit-learn.org/) - TF-IDF semantic linking

---

**Status**: Active Development
**Version**: 2.0.0
