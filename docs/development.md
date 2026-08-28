# Development Guide

Setup, day-to-day commands, and the recipes for extending NexoNote.

## Prerequisites

**Required**

- **Node.js 22.12+** — Vite 7 requires `^20.19.0 || >=22.12.0` and Electron 42 requires `>=22.12.0`, so 22.12 is the effective floor. Node 18 will not build this project.
- **npm 10+**

**Required for Electron mode only**

A native build toolchain, so `better-sqlite3` can be compiled against Electron's ABI:

| Platform | Requirement |
| --- | --- |
| Windows | Visual Studio Build Tools with the "Desktop development with C++" workload |
| macOS | Xcode Command Line Tools (`xcode-select --install`) |
| Linux | `build-essential` and `python3` |

Without it, `npm install` fails at the `postinstall` rebuild step. Browser mode (`npm run dev`) is unaffected.

**Optional**

- **Python 3.9+** — needed for semantic linking and the FastAPI backend. Without Python the app still runs; semantic linking is unavailable and Electron falls back to its built-in Node/SQLite backend.

## Running the app

```bash
npm install
```

Then pick a mode:

| Command | What runs | Where notes are stored |
| --- | --- | --- |
| `npm run dev` | Vite + the semantic linking server | `localStorage` |
| `npm run dev:vite` | Vite alone | `localStorage` |
| `npm run electron:dev` | Vite + the Electron shell | SQLite (`nexonote.db`) |

Browser mode serves at `http://127.0.0.1:5173`, or the next free port — `strictPort` is off, so Vite moves to 5174+ when 5173 is taken.

Electron runs the same React app in a window. Its database lives under the app's user data directory, and legacy JSON data files are migrated to SQLite automatically on first launch.

## Python setup

One command sets up both the semantic linking engine and the FastAPI backend:

```bash
npm run setup:python
```

It creates a project-local `.venv`, installs both requirement files into it, downloads the NLTK corpora, and runs the semantic linking pipeline once to prove it works. Rerunning is safe.

| Flag | Effect |
| --- | --- |
| `-- --force` | Rebuild the virtualenv from scratch |
| `-- --no-backend` | Skip the FastAPI dependencies |

Both `npm run dev` and Electron pick up that `.venv` automatically — there is nothing to activate. To use a Python you manage yourself, set `NEXONOTE_SEMANTIC_PYTHON` (or `NEXONOTE_BACKEND_PYTHON`) to its full path and skip the setup command.

Interpreter candidates are probed in order, and the first that can import the required packages wins:

1. `$NEXONOTE_SEMANTIC_PYTHON` / `$NEXONOTE_BACKEND_PYTHON`
2. the project-local `.venv`
3. `py -3` on Windows, `python3` elsewhere
4. `python`

If none qualify, the error names every interpreter tried and why each was rejected. Nothing is pinned to a specific Python version.

## All scripts

```bash
npm run dev              # Vite + semantic linking server (browser, localStorage)
npm run dev:vite         # Vite alone
npm run electron:dev     # Electron desktop app (SQLite)

npm run setup:python     # Create .venv, install Python deps, download NLTK corpora
npm run test:python      # Run the semantic linking test suite
npm run server:python    # Start the FastAPI backend on its own
npm run server:semantic  # Start the semantic linking server on its own

npm run build            # Production build of the renderer into dist/
npm run preview          # Serve the production build
npm run lint             # ESLint (CI enforces this)

npm run rebuild          # Rebuild better-sqlite3 against Electron's ABI
npm run dist             # Package an installer into release/
npm run dist:dir         # Package unpacked (faster, no installer)
```

## Import conventions

`@/` resolves to `src/`. The rule is one line:

- **Crossing a directory boundary** uses the alias: `import { getNotes } from '@/services/noteService'`
- **Same directory** stays relative: `import ItemMenu from './ItemMenu'`

This keeps imports stable when a file moves, and avoids `../../..` chains as the tree
gets deeper. The alias is declared in two places and both must agree:

| File | Consumer |
| --- | --- |
| `vite.config.js` (`resolve.alias`) | Dev server and production build |
| `jsconfig.json` (`compilerOptions.paths`) | Editor go-to-definition and autocomplete |

ESLint does not resolve import paths here — there is no `eslint-plugin-import` in the
config — so a broken path surfaces at build time, not at lint time.

## Recipes

### Add a new data entity

An entity has to land in all three storage tiers, or it will work in one mode and
silently fail in another. See [architecture.md](./architecture.md) for how the tiers
are selected, and [backend-api-contract.md](./backend-api-contract.md) for the shape
both server tiers must implement.

**Electron / SQLite tier**

1. Add the `CREATE TABLE` to `initSchema` in `electron/database.cjs`
2. Add CRUD functions there (`entityGetAll`, `entityCreate`, …)
3. Register IPC handlers in `electron/main.cjs` (`entity:getAll`, `entity:create`, …)
4. Expose them on `contextBridge` in `electron/preload.cjs`

**FastAPI tier**

5. Mirror the schema in `backend/db.py`
6. Add `backend/routers/entity.py` and register it in `backend/main.py`
7. Add the matching methods to `createBackendClient` in `src/apiClient.js`

**Renderer**

8. Create `src/services/entityService.js`, following the existing three-branch pattern:
   HTTP client if `getBackendClient()` resolves, else `window.electronAPI`, else `localStorage`
9. Add state and handlers in `src/App.jsx`

### Add a new component

1. Create the file in `src/components/`
2. Add its styles to the matching file in `src/styles/` (see [styling.md](./styling.md))
3. Import it where it is used
4. Use CSS variables for every color — see [styling.md](./styling.md)
5. Check it in both dark and light themes

### Rebuild native modules

After an `npm install` or a Node version change, if `better-sqlite3` fails to load:

```bash
npm run rebuild
```

### Run the database smoke tests

```bash
node electron/test-database.cjs
```

### Run the Python tests

```bash
npm run test:python
```

## Troubleshooting

**`npm install` fails at postinstall** — the native toolchain is missing. See
Prerequisites above, or use browser mode, which does not need `better-sqlite3`.

**`better-sqlite3` fails to load in Electron** — run `npm run rebuild`.

**Semantic linking panel shows an interpreter error** — run `npm run setup:python`
and reopen the sidebar. No app restart is needed.

**Related notes is empty with only two notes** — expected, not a bug. See the
Limitations section of [semantic-linking.md](./semantic-linking.md).

**Port 5173 is taken** — Vite moves to the next free port on its own and prints it.

## Before committing

- `npm run lint` passes
- No console errors or warnings
- Colors come from CSS variables, not literals
- Verified in both dark and light themes
- Docs updated if behavior or structure changed
