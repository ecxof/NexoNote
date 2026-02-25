# 📚 NexoNote - Desktop Study Application

> A modern desktop note-taking application built with React, Electron, and SQLite. Rich text editing, PDF support, and offline-first storage.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Status](https://img.shields.io/badge/status-Active%20Development-green)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

## 🎯 Overview

NexoNote is a desktop note-taking and study companion built with Electron and React. It supports rich text editing, PDF import/viewing, folder-based organization, and local-only storage.

### Key Features
- 📝 **Rich Text Editor** - Full formatting: bold, italic, headings, lists, highlights, images, links, code blocks
- 📂 **File & Folder Management** - Nested folders, rename, copy, move, delete for notes and PDFs
- 📄 **PDF Support** - Import, view (inline embed), and manage PDF files alongside notes
- 🏷️ **Tags** - Tag notes with autocomplete suggestions and inline editing
- 🖥️ **Tab Bar** - Open multiple notes and PDFs in browser-style tabs
- 🗄️ **SQLite Storage** - Local database in Electron mode; localStorage fallback in browser
- 🌗 **Dark & Light Themes** - Configurable via Settings, applies instantly
- 🔐 **Offline-First** - All data stored locally, no cloud required
- 🔗 **Semantic Linking** - Related notes (TF-IDF), in-editor keyword highlights, and a force-directed semantic graph. See [semantic_linking/README.md](semantic_linking/README.md) for setup.
- 🤖 **AI Assistant** - In-note chat with Explain This, Summarize, and Quiz Me (Hugging Face). Copy `.env.example` to `.env` and set `VITE_HF_API_TOKEN` to your [Hugging Face token](https://huggingface.co/settings/tokens).

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm 10+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd nexonote

# Install dependencies
npm install

# Start development server (browser; notes stored in localStorage)
npm run dev

# Or run as Electron desktop app (notes stored in app data JSON files)
npm run electron:dev
```

- **Browser:** Visit `http://localhost:5173` (or the port Vite prints). Notes and settings use `localStorage`.
- **Electron:** Runs the same React app in a window; notes and settings are stored in JSON files under the app’s user data directory.

---

## 📦 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | React 19 | Components and state |
| Build Tool | Vite 7.x | Fast HMR dev server |
| Desktop Shell | Electron 33.x | Native window, file system, IPC |
| Rich Text Editor | TipTap 3.x (ProseMirror) | Note content editing |
| Database | better-sqlite3 12.x | Local storage (Electron mode) |
| Icons | Lucide React | UI iconography |
| IDs | nanoid | Unique identifiers |
| Styling | CSS Variables + Flexbox + Grid | Theming and layout |

---

## 🏗️ Project Structure

```
NexoNote/
├── electron/
│   ├── main.cjs                 # Electron main process + IPC handlers
│   ├── preload.cjs              # contextBridge API
│   ├── database.cjs             # SQLite schema, CRUD, migration
│   └── test-database.cjs        # Database smoke tests
├── src/
│   ├── components/              # 18 React components
│   │   ├── Dashboard.jsx        # Home view
│   │   ├── RichTextEditor.jsx   # TipTap editor + toolbars
│   │   ├── NoteEditor.jsx       # Note editing wrapper
│   │   ├── PDFViewer.jsx        # PDF viewer (embed)
│   │   ├── Sidebar.jsx          # Main nav sidebar
│   │   ├── SidebarTree.jsx      # Folder/note/PDF tree
│   │   ├── TabBar.jsx           # Open file tabs
│   │   ├── FolderView.jsx       # Folder contents
│   │   ├── Settings.jsx         # App settings
│   │   └── ...                  # (see COMPLETE_FILE_LISTING.md)
│   ├── services/                # Data access layer (4 files)
│   │   ├── noteService.js       # Note CRUD
│   │   ├── folderService.js     # Folder CRUD
│   │   ├── pdfService.js        # PDF CRUD
│   │   └── settingsService.js   # Settings read/write
│   ├── context/
│   │   └── ItemMenuContext.jsx   # Single-open menu context
│   ├── App.jsx                  # Root component + global state
│   ├── App.css                  # Component styles
│   ├── index.css                # CSS variables + themes
│   └── main.jsx                 # Entry point
├── public/                      # Static assets + logo
└── package.json
```

---

## 🎨 Design System

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

- **Sidebar**: Fixed width (256px / w-64)
- **Main Content**: Flex-grow, scrollable
- **Dashboard Grid**: Responsive auto-fit layout
- **Breakpoints**: 
  - Mobile: < 768px (1 column)
  - Tablet: 768px - 1200px (2 columns)
  - Desktop: 1200px+ (3 columns)

---

## 📖 Available Scripts

```bash
# Development (browser, uses localStorage)
npm run dev

# Development (Electron desktop app, uses SQLite)
npm run electron:dev

# Production build
npm run build

# Rebuild native modules for Electron
npm run rebuild

# Code quality
npm run lint
```

---

## 📚 Documentation

We provide comprehensive documentation for all aspects of the project:

1. **[QUICK_START.md](./QUICK_START.md)** - Get started in 5 minutes
2. **[PROJECT_SETUP.md](./PROJECT_SETUP.md)** - Complete setup guide
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture & design
4. **[STYLING_GUIDELINES.md](./STYLING_GUIDELINES.md)** - CSS best practices

---

## 🏠 Application Views

### Dashboard (Home)
- Greeting header with "Create New Note" and "Import PDF" buttons
- Flashcard hero card (placeholder)
- Recent notes grid with tags, file path, and timestamps

### Note Editor
- Editable title and rich text body (TipTap)
- Full toolbar: undo/redo, headings, bold, italic, strikethrough, underline, highlight (split-button with color picker), lists, alignment, links, images, code blocks
- Floating contextual toolbar on text selection
- Left sidebar: tags, contents outline, semantic graph placeholder
- Right sidebar: AI assistant placeholder, flashcard placeholder, export

### Folder View
- Breadcrumb navigation, search bar, sort control
- Grid/list view toggle
- Folder, note, and PDF cards with three-dot menus

### Settings
- Auto-save toggle, font size selector, dark/light theme toggle

---

## 🎯 Features

### ✅ Implemented
- [x] Rich text editor (TipTap): bold, italic, underline, strikethrough, headings (H1–H4), bullet/ordered/task lists, blockquote, code/code block, highlight (multi-color), links, images, text alignment, sub/superscript
- [x] Floating contextual toolbar on text selection
- [x] Full file/folder CRUD (create, rename, copy, move, delete)
- [x] Nested folder hierarchy
- [x] PDF import, inline viewing, and file management
- [x] Tab bar for multi-file editing
- [x] Tags system with autocomplete and inline editing
- [x] Dark and light theme support (instant toggle)
- [x] Settings panel (auto-save, font size, theme)
- [x] Resizable + collapsible sidebars (main, note-left, note-right)
- [x] SQLite storage backend (Electron mode)
- [x] localStorage fallback (browser dev mode)
- [x] Note export to PDF (via print)
- [x] Custom modals (confirm, prompt) replacing browser dialogs
- [x] Breadcrumb navigation in folder view and note view

### 📋 Upcoming
- [ ] Semantic graph / knowledge map
- [ ] AI-assisted "Explain This" feature
- [ ] Flashcard generation (MCQ, True/False, Flip Card)
- [ ] Full Electron packaging and distribution
- [ ] Python ML integration for analytics

---

## 🎓 Development Guide

### Adding a New Component

1. Create component file in `src/components/YourComponent.jsx`
2. Add styles to `src/App.css`
3. Import and use in parent component
4. Use CSS variables for colors
5. Ensure dark theme compatibility

Example:
```jsx
function YourComponent() {
  return (
    <div className="your-component">
      <h3 className="your-component-title">Title</h3>
      <p className="your-component-description">Description</p>
    </div>
  );
}

export default YourComponent;
```

### Styling Best Practices

- Always use CSS variables from `index.css`
- Use Flexbox for layouts
- Add hover states for interactive elements
- Maintain dark theme consistency
- Use semantic HTML
- Keep styles organized and commented

See [STYLING_GUIDELINES.md](./STYLING_GUIDELINES.md) for detailed guidance.

---

## 🔧 Configuration

### Vite Configuration
The project uses Vite 7.2.4 with React plugin. Configuration is in `vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react()],
})
```

### ESLint
ESLint rules are configured in `eslint.config.js` with React-specific rules for code quality.

---

## 🚀 Deployment

### Build for Production (Web)
```bash
npm run build
```
Creates an optimized build in the `dist/` directory.

### Electron Desktop App
```bash
# Development
npm run electron:dev

# If better-sqlite3 fails to load, rebuild native modules:
npm run rebuild
```

Electron packaging for distribution (e.g., electron-builder) is planned but not yet configured.

---

## 🤝 Contributing

Contributions are welcome! Please ensure:
1. Code follows the style guide in STYLING_GUIDELINES.md
2. All components are dark-theme compatible
3. Responsive design is tested
4. Documentation is updated

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 📞 Support

For questions or issues:
1. Check the documentation files
2. Review existing components
3. Check ARCHITECTURE.md for system design

---

## 🗺️ Roadmap

### Phase 1: Core Note Editor ✅
- Rich text editor with full formatting
- File/folder management with CRUD
- Settings panel
- Dark/light themes

### Phase 2: PDF & Storage ✅
- PDF import, viewing, file management
- Tab bar for multi-file workspace
- SQLite database backend
- JSON-to-SQLite migration

### Phase 3: Intelligence (Next)
- Semantic graph / knowledge linking
- AI-assisted "Explain This" for selected text
- Flashcard generation and review

### Phase 4: Distribution
- Electron packaging (installer builds)
- Auto-update support
- Performance optimization

### Phase 5: Analytics
- Python ML backend integration
- Study pattern analysis
- Personalized recommendations

---

## 👨‍💻 Built With

- [React](https://react.dev) - UI Framework
- [Vite](https://vitejs.dev) - Build Tool
- [Modern CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) - Styling
- [Electron](https://www.electronjs.org/) - Desktop Integration (Coming)
- [SQLite](https://www.sqlite.org/) - Database (Coming)
- [Python](https://www.python.org/) - ML Backend (Coming)

---

**Status**: 🟢 Active Development  
**Last Updated**: February 14, 2026  
**Version**: 2.0.0  

Enjoy studying smarter with NexoNote!

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
