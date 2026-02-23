# NexoNote Architecture Overview

## System Architecture

```
Renderer Process (React + Vite)          Main Process (Electron + Node)
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  React Components            │        │  electron/main.cjs           │
│  (Dashboard, NoteEditor,     │  IPC   │  - Window management         │
│   FolderView, PDFViewer,     │◄─────►│  - IPC handlers              │
│   Sidebar, TabBar, Settings) │        │                              │
│                              │        │  electron/database.cjs       │
│  Service Layer               │        │  - SQLite schema + queries   │
│  (noteService, folderService,│        │  - JSON migration            │
│   pdfService, settingsService│        │                              │
│                              │        │  electron/preload.cjs        │
│  localStorage fallback       │        │  - contextBridge API         │
│  (browser dev mode)          │        │                              │
└──────────────────────────────┘        │  nexonote.db (SQLite)        │
                                        └──────────────────────────────┘
```

### Storage Routing

All service files use a `hasElectron()` check:
- **Electron mode** (`npm run electron:dev`): IPC → main process → SQLite
- **Browser mode** (`npm run dev`): localStorage directly

---

## Component Hierarchy

```
App.jsx (root state: notes, folders, pdfs, tabs, settings, modals)
├── ItemMenuProvider (context for single-open three-dot menus)
├── ConfirmModal / PromptModal (global modals)
├── Sidebar (resizable, collapsible)
│   ├── Logo + Navigation (Home, Folders, Settings)
│   └── SidebarTree
│       ├── "All Notes" button
│       ├── Uncategorized notes + PDFs (with NoteItemMenu / PdfItemMenu)
│       └── Folder nodes (recursive, with FolderItemMenu)
│           ├── Child folders
│           ├── Notes (with NoteItemMenu)
│           └── PDFs (with PdfItemMenu)
│
└── MainContent (view router)
    ├── view="dashboard" → Dashboard
    │   ├── Welcome header + Create Note / Import PDF buttons
    │   ├── Flashcard hero card
    │   └── Recent notes grid (with NoteItemMenu)
    │
    ├── view="folder" → FolderView
    │   ├── Breadcrumb navigation
    │   ├── Search + sort + grid/list toggle
    │   └── Folder cards + Note cards + PDF cards (with menus)
    │
    ├── view="settings" → Settings
    │   └── Auto-save toggle, font size, theme selector
    │
    ├── view="editor" → WorkspaceLayout
    │   ├── NoteViewSidebar (left, resizable)
    │   │   ├── Tags section (add/edit/delete with autocomplete)
    │   │   ├── Semantic Graph placeholder
    │   │   └── Contents outline (heading navigation)
    │   │
    │   ├── TabBar (horizontal tabs for open notes/PDFs)
    │   ├── Content area (switches on active tab type):
    │   │   ├── EmptyTabView (no file open)
    │   │   ├── NoteEditor → RichTextEditor (TipTap)
    │   │   │   ├── Toolbar (formatting, headings, lists, etc.)
    │   │   │   ├── Editor body (TipTap ProseMirror)
    │   │   │   └── Floating selection toolbar (bold, italic, highlight, "Explain This")
    │   │   └── PDFViewer (embed tag + data URL)
    │   │
    │   └── NoteViewRightSidebar (right, resizable)
    │       ├── AI Assistant section (placeholder cards)
    │       ├── Flashcards section (placeholder)
    │       └── Export button (note → PDF via print)
    │
    └── view="semantic-map" → Semantic Map placeholder
```

---

## File Structure

```
NexoNote/
├── electron/
│   ├── main.cjs              # Electron main process, IPC handlers
│   ├── preload.cjs            # contextBridge API (notes, folders, pdfs, settings)
│   ├── database.cjs           # SQLite init, schema, CRUD, JSON migration
│   └── test-database.cjs      # Smoke tests for database module
│
├── semantic_linking/          # Python backend: semantic note linking
│   ├── __init__.py            # Exposes find_semantic_links()
│   ├── pipeline.py            # HTML strip, preprocessing, TF-IDF, cosine similarity
│   ├── requirements.txt       # scikit-learn, nltk
│   └── README.md              # Setup, usage, integration notes
│
├── src/
│   ├── main.jsx               # React entry point
│   ├── App.jsx                # Root component, global state, handlers
│   ├── App.css                # All component styles (~3400 lines)
│   ├── index.css              # CSS variables, global resets, themes
│   │
│   ├── components/
│   │   ├── Dashboard.jsx      # Home view with recent notes
│   │   ├── EmptyTabView.jsx   # "No file open" placeholder
│   │   ├── FolderList.jsx     # Legacy folder list (unused)
│   │   ├── FolderView.jsx     # Folder contents with search/sort/grid
│   │   ├── ItemMenu.jsx       # Three-dot menus (NoteItemMenu, PdfItemMenu, FolderItemMenu)
│   │   ├── MainContent.jsx    # View router + workspace layout
│   │   ├── Modal.jsx          # ConfirmModal, PromptModal
│   │   ├── NoteEditor.jsx     # Note editing wrapper (title + RichTextEditor)
│   │   ├── NoteList.jsx       # Legacy note list (unused)
│   │   ├── NoteViewRightSidebar.jsx  # AI + flashcards sidebar
│   │   ├── NoteViewSidebar.jsx       # Tags, graph, contents sidebar
│   │   ├── PDFFloatingToolbar.jsx    # Selection toolbar for PDFs
│   │   ├── PDFViewer.jsx      # PDF rendering with embed + data URL
│   │   ├── RichTextEditor.jsx # TipTap editor with toolbar + floating toolbar
│   │   ├── Settings.jsx       # Auto-save, font size, theme
│   │   ├── Sidebar.jsx        # Main nav sidebar (resizable, collapsible)
│   │   ├── SidebarTree.jsx    # Hierarchical folder/note/PDF tree
│   │   └── TabBar.jsx         # Horizontal tab bar for open files
│   │
│   ├── services/
│   │   ├── noteService.js     # Note CRUD (IPC or localStorage)
│   │   ├── folderService.js   # Folder CRUD (IPC or localStorage)
│   │   ├── pdfService.js      # PDF CRUD (IPC or localStorage)
│   │   └── settingsService.js # Settings read/write (IPC or localStorage)
│   │
│   └── context/
│       └── ItemMenuContext.jsx # Single-open menu behavior
│
├── public/
│   ├── vite.svg
│   └── NexoNote Logo 2.png
│
├── package.json               # Dependencies + scripts
├── vite.config.js             # Vite configuration
└── eslint.config.js           # ESLint configuration
```

---

## Data Model

### Entities

| Entity   | Key Fields                                           | Storage              |
|----------|------------------------------------------------------|----------------------|
| Note     | id, title, content (HTML), folderId, tags[], createdAt, updatedAt | SQLite `notes` table / localStorage |
| Folder   | id, name, parentId (self-ref for nesting), createdAt | SQLite `folders` table / localStorage |
| PDF      | id, title, filePath (data URL or path), folderId, createdAt, updatedAt | SQLite `pdfs` table / localStorage |
| Tag      | id (auto), name (unique)                             | SQLite `tags` + `note_tags` join table |
| Settings | key-value pairs (autoSave, fontSize, theme, sidebarWidth, sidebarCollapsed) | SQLite `settings` table / localStorage |

### Relationships

- Note.folderId → Folder.id (nullable; null = uncategorized)
- PDF.folderId → Folder.id (nullable)
- Folder.parentId → Folder.id (self-referential for nesting)
- Note ↔ Tag: many-to-many via `note_tags` join table
- On folder delete: subfolders re-parented, notes/PDFs moved to "All"

---

## State Management

All global state lives in `App.jsx`:

| State           | Type       | Purpose                            |
|-----------------|------------|------------------------------------|
| notes           | Note[]     | All notes                          |
| folders         | Folder[]   | All folders                        |
| pdfs            | PDF[]      | All PDFs                           |
| tabs            | Tab[]      | Open tabs (type, resourceId, label)|
| activeTabId     | string     | Currently active tab               |
| view            | string     | Current view (dashboard/folder/editor/settings) |
| settings        | object     | App settings                       |
| currentNoteId   | string     | Active note for editor             |
| selectedFolderId| string     | Active folder for folder view      |
| copiedNoteId    | string     | Clipboard for note copy/paste      |
| copiedPdfId     | string     | Clipboard for PDF copy/paste       |
| modal           | object     | Active modal config                |

---

## Technology Stack

| Layer        | Technology           | Version  |
|--------------|----------------------|----------|
| UI Framework | React                | 19.2.0   |
| Build Tool   | Vite                 | 7.x      |
| Desktop Shell| Electron             | 33.x     |
| Rich Text    | TipTap (StarterKit)  | 3.19.0   |
| Database     | better-sqlite3       | 12.x     |
| Semantic Linking | Python (scikit-learn, NLTK) | see semantic_linking/README.md |
| Icons        | Lucide React         | 0.563.0  |
| IDs          | nanoid               | 5.x      |

---

## Performance Considerations

- better-sqlite3 is synchronous (no async overhead, fine for single-window)
- WAL journal mode for concurrent reads
- Service layer caches nothing — reads go to storage on every call
- TipTap editor is the heaviest component; content stored as HTML
- PDF data URLs can be large (base64); stored in SQLite `file_path` column
- Tab switching preserves component state via conditional rendering

---

**Architecture Version**: 2.1
**Last Updated**: February 2026
**Status**: Rich text editor, file management, settings, PDF support, SQLite migration, and semantic linking Python backend complete
