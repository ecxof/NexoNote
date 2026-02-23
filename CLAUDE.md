# Project: NexoNote

## Overview

NexoNote is a desktop note-taking app built with Electron + React.
It focuses on:

- Rich text note editing (TipTap-based)
- Local file-based note storage (localStorage in browser, SQLite in Electron)
- PDF import, viewing, and management
- File/folder organization with nested hierarchy
- Semantic linking (Python backend: TF-IDF + cosine similarity)
- AI-assisted explanations (later phase)

## Current State

- Rich text editor fully functional (bold, italic, headings, lists, highlights, images, links, etc.)
- File/folder management with full CRUD (create, rename, delete, copy, move)
- Nested folder support with sidebar tree and folder view
- PDF import, viewing (via embed tag with data URLs), and file management
- Tab bar system for opening multiple notes/PDFs
- Settings panel (auto-save, font size, theme toggle)
- Dark and light theme support
- Tags system on notes with autocomplete
- Floating contextual toolbar on text selection
- Note view with left sidebar (tags, contents outline) and right sidebar (AI placeholder, flashcard placeholder)
- SQLite database backend for Electron mode (feature/sqlite-migration branch)
- localStorage fallback for browser dev mode
- Semantic linking backend: Python package `semantic_linking/` (scikit-learn + NLTK), consumes `notes.content` (HTML)

## Tech Stack

- Electron (desktop shell)
- React 19 (frontend)
- TipTap (rich text editor)
- Vite (build tool)
- better-sqlite3 (database, Electron only)
- localStorage (browser dev fallback)
- Lucide React (icons)
- nanoid (ID generation)

## Architecture

- `src/` – React frontend (components, services, context, styles)
- `electron/` – Electron main process, preload, SQLite database module
- `src/services/` – Data access layer with `hasElectron()` pattern (IPC when Electron, localStorage when browser)
- `electron/database.cjs` – SQLite schema, CRUD queries, JSON-to-SQLite migration
- `semantic_linking/` – Python package for semantic linking (HTML → TF-IDF → cosine similarity; see `semantic_linking/README.md`)

## Development Rules

- Build feature-by-feature (vertical slices)
- Prefer simple, explicit implementations
- Offline-first
- Keep logic readable for students
- No changes to `src/` files needed when modifying the storage backend


## Expectations from Claude

- Explain decisions before coding
- Ask before large refactors
