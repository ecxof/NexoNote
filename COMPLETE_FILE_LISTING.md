# NexoNote - Complete File Listing

## Source Code

### React Components (`src/components/`) — 18 files

| File | Purpose |
|------|---------|
| Dashboard.jsx | Home view: greeting, create note, import PDF, flashcard hero, recent notes grid |
| EmptyTabView.jsx | Placeholder shown when no file is open in a tab |
| FolderList.jsx | Legacy sidebar folder list (not actively used) |
| FolderView.jsx | Folder contents view: breadcrumb, search, sort, grid/list, note + PDF cards |
| ItemMenu.jsx | Three-dot context menus: NoteItemMenu, PdfItemMenu, FolderItemMenu |
| MainContent.jsx | View router (dashboard / folder / editor / settings / semantic-map) + workspace layout |
| Modal.jsx | Reusable modals: ConfirmModal, PromptModal |
| NoteEditor.jsx | Note editing wrapper: editable title, date, breadcrumb, RichTextEditor |
| NoteList.jsx | Legacy note list component (not actively used) |
| NoteViewRightSidebar.jsx | Right sidebar: AI Assistant cards (placeholder), Flashcard buttons, Export |
| NoteViewSidebar.jsx | Left sidebar: Tags (add/edit/delete/autocomplete), Semantic Graph, Contents outline |
| PDFFloatingToolbar.jsx | Floating toolbar on text selection in PDF viewer |
| PDFViewer.jsx | PDF rendering via embed tag, blob-to-data URL conversion, loading/error states |
| RichTextEditor.jsx | TipTap editor: full toolbar, floating selection toolbar, highlight split-button |
| Settings.jsx | Settings panel: auto-save toggle, font size selector, theme toggle |
| Sidebar.jsx | Main navigation sidebar: resizable, collapsible, logo, nav items, add note/folder |
| SidebarTree.jsx | Hierarchical folder tree: expandable folders, notes, PDFs, with item menus |
| TabBar.jsx | Horizontal tab bar: open tabs, active indicator, close buttons, + new tab |

### Services (`src/services/`) — 4 files

| File | Purpose |
|------|---------|
| noteService.js | Note CRUD. Uses Electron IPC when available, localStorage otherwise |
| folderService.js | Folder CRUD. Same dual-backend pattern |
| pdfService.js | PDF metadata CRUD + duplicate. Same dual-backend pattern |
| settingsService.js | Settings read/write (autoSave, fontSize, theme, sidebarWidth, sidebarCollapsed) |

### Context (`src/context/`) — 1 file

| File | Purpose |
|------|---------|
| ItemMenuContext.jsx | React context ensuring only one three-dot menu is open at a time |

### Root Source Files (`src/`)

| File | Purpose |
|------|---------|
| main.jsx | React entry point (createRoot) |
| App.jsx | Root component: global state, handlers, modals, view routing |
| App.css | All component styles (~3400 lines) |
| index.css | CSS variables, global resets, dark/light theme definitions |

### Assets (`src/assets/`)

| File | Purpose |
|------|---------|
| react.svg | React logo (default Vite asset) |

---

## Electron Files (`electron/`) — 4 files

| File | Purpose |
|------|---------|
| main.cjs | Electron main process: BrowserWindow, IPC handlers for notes/folders/pdfs/settings |
| preload.cjs | contextBridge: exposes `window.electronAPI` with notes, folders, pdfs, settings namespaces |
| database.cjs | SQLite module: schema init, CRUD functions, JSON-to-SQLite migration |
| test-database.cjs | Smoke test suite for database.cjs (39 tests) |

---

## Public Assets (`public/`)

| File | Purpose |
|------|---------|
| vite.svg | Vite logo (default) |
| NexoNote Logo 2.png | Application logo used in sidebar and dashboard |

---

## Configuration Files (root)

| File | Purpose |
|------|---------|
| package.json | Dependencies, scripts (dev, electron:dev, build, rebuild) |
| package-lock.json | Dependency lock file |
| vite.config.js | Vite + React plugin config |
| eslint.config.js | ESLint rules |
| index.html | HTML entry point with `<div id="root">` |

---

## Documentation Files (root)

| File | Purpose |
|------|---------|
| README.md | Project overview, quick start, features, roadmap |
| CLAUDE.md | AI assistant context and project rules |
| ARCHITECTURE.md | System architecture, component hierarchy, data model |
| COMPLETE_FILE_LISTING.md | This file — full inventory of all project files |
| DEVELOPER_CHECKLIST.md | Daily dev workflow, code standards, troubleshooting |
| DOCUMENTATION_INDEX.md | Index/navigation for all documentation |
| STYLING_GUIDELINES.md | CSS conventions, variables, component patterns |
| COLOR_AND_STYLE_REFERENCE.md | Color palette, typography, spacing, accessibility |
| QUICK_START.md | 5-minute setup guide |
| PROJECT_SETUP.md | Detailed project setup documentation |
| SETUP_CHECKLIST.md | Verification and progress tracking |
| COMPLETE_SETUP_SUMMARY.md | Completion overview |
| PROJECT_COMPLETION_REPORT.md | Final project report |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| React Components | 18 |
| Services | 4 |
| Context Providers | 1 |
| Root Source Files | 4 |
| Electron Files | 4 |
| Public Assets | 2 |
| Config Files | 5 |
| Documentation Files | 13 |
| **Total** | **51** |

---

**Last Updated**: February 14, 2026
