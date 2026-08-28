# Styling Guide

Every color, size, and interaction in NexoNote comes from a small set of CSS
variables and conventions. This document is the reference for both.

## Where styles live

```
src/
├── styles/
│   ├── main.css      # Barrel: @imports everything below, in cascade order
│   ├── tokens.css    # CSS variables, both themes, base elements
│   └── base.css      # Shared primitives: buttons, modals, cards, scrollbars
├── app/
│   ├── shell.css
│   ├── sidebar.css
│   └── tabs.css
└── features/
    ├── dashboard/dashboard.css
    ├── folders/folders.css
    ├── notes/editor.css, noteview.css
    ├── assistant/assistant.css
    ├── semantic/semantic.css
    ├── pdfs/pdfs.css
    ├── flashcards/flashcards.css
    └── settings/settings.css
```

Each feature's stylesheet sits in its own directory next to the components it
styles. `App.jsx` imports only `styles/main.css`, which pulls in the rest.

> [!IMPORTANT]
> The `@import` order in `main.css` is load-bearing. It reproduces the cascade order
> of the single `App.css` these files were split out of, so a later file wins ties
> against an earlier one. Put a new file where its rules need to sit, not
> alphabetically.

## Design tokens

All colors are CSS variables, defined in `src/styles/tokens.css`. Never write a color literal in a component style —
a hardcoded value will look correct in one theme and wrong in the other.

| Variable | Dark | Light | Usage |
| --- | --- | --- | --- |
| `--bg-primary` | `#0f172a` | `#f8fafc` | Main app background |
| `--bg-secondary` | `#111827` | `#ffffff` | Cards, panels, content surfaces |
| `--bg-sidebar` | `#13161C` | `#f1f5f9` | Sidebar background |
| `--accent-primary` | `#2563EB` | `#2563eb` | Buttons, active states, links |
| `--accent-hover` | `#1d4ed8` | `#1d4ed8` | Button hover |
| `--text-primary` | `#ffffff` | `#0f172a` | Headings, emphasized text |
| `--text-secondary` | `#9ca3af` | `#475569` | Body text |
| `--text-tertiary` | `#6b7280` | `#64748b` | Placeholders, subtle labels |
| `--border-color` | `#1f2937` | `#e2e8f0` | Dividers and borders |
| `--sidebar-active-bg` | — | `#e2e8f0` | Active sidebar pill |

### Highlight palette

Used for editor highlight swatches, and at low opacity inside the editor body.
These shift substantially between themes — the dark values are muted, the light
values are saturated enough to stay visible on white.

| Variable | Dark | Light |
| --- | --- | --- |
| `--color-green` | `#6FB38A` | `#15803d` |
| `--color-blue` | `#7FA9C4` | `#0369a1` |
| `--color-red` | `#A15A5A` | `#b91c1c` |
| `--color-purple` | `#7B5FA0` | `#6d28d9` |
| `--color-yellow` | `#A89A3A` | `#a16207` |
| `--color-muted` | `#2E2E2E` | `#e2e8f0` |

### How theming works

Dark is defined on `:root`. Light overrides the same variable names under
`[data-theme="light"]`, which is set on the document element from Settings and
applies instantly with no reload.

Because both themes redefine the *same* names, a component that uses only
variables needs no theme-specific CSS at all. Write theme overrides only when the
variables genuinely cannot express the difference — those live alongside the rules
they override, under `[data-theme="light"] …` selectors.

## Typography

Font stack: `system-ui, 'Segoe UI', Avenir, Helvetica, Arial, sans-serif`

| Element | Size | Weight |
| --- | --- | --- |
| `h1` | 2.5rem (40px) | 600 |
| `h2` | 2rem (32px) | 600 |
| `h3` | 1.5rem (24px) | 500 |
| Body | 1rem (16px) | 400 |
| Small | 0.95rem (15px) | 400 |
| Tiny | 0.85rem (13.6px) | 400 |

Line height is 1.5 globally.

## Spacing scale

| Name | Value | Typical use |
| --- | --- | --- |
| xs | 0.25rem (4px) | Tiny gaps |
| sm | 0.5rem (8px) | Small gaps |
| md | 1rem (16px) | Standard padding, flex gaps |
| lg | 1.5rem (24px) | Card padding |
| xl | 2rem (32px) | Main content padding, grid gaps, section spacing |
| 2xl | 3rem (48px) | Large separations |

## Component dimensions

### Sidebar

Drag-resizable, not fixed. The constants live in `src/app/Sidebar.jsx`:

| Constant | Value |
| --- | --- |
| `DEFAULT_WIDTH` | 280px |
| `MIN_WIDTH` | 200px |
| `MAX_WIDTH` | 480px |
| `COLLAPSED_WIDTH` | 56px |
| `RESIZE_HANDLE_WIDTH` | 4px |

The width is persisted to settings as `sidebarWidth` and clamped on both read and
drag. The note view's left and right sidebars are independently resizable too.

### Cards and buttons

```css
.card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.25s ease;
}

.card:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
}
```

Buttons are styled globally in `styles/tokens.css` — accent background, 6px radius,
`0.6rem 1.2rem` padding, a `translateY(-2px)` hover lift, and a visible
`focus-visible` outline. A component only needs its own button rule when it
departs from that.

## Interaction conventions

| Pattern | Rule |
| --- | --- |
| Standard transition | `transition: all 0.25s ease;` |
| Hover lift | `transform: translateY(-2px);` |
| Hover border | `border-color: var(--accent-primary);` |
| Active state | `background-color: var(--accent-primary);` |
| Focus | `outline: 2px solid var(--accent-primary); outline-offset: 2px;` |
| Card shadow | `box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);` on hover only |

One deliberate exception: the editor's floating selection toolbar sets
`transform: none` on button hover, so it stays anchored to the selection instead
of drifting during scroll.

## Layout and responsiveness

The dashboard grid is intrinsically responsive and needs no breakpoints:

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}
```

The column count follows the available width, which matters here because the
sidebar is user-resizable — the content area's width is not a function of the
viewport alone.

Explicit breakpoints are used only where the layout genuinely has to change, and
they are max-width (desktop-down), not mobile-first. There are three, each sitting
at the end of the stylesheet whose rules it overrides:

| Breakpoint | Purpose |
| --- | --- |
| `max-width: 1100px` | Workspace layout adjustments |
| `max-width: 900px` | Flashcard and analytics layout |
| `max-width: 840px` | Narrowest supported layout |

## Naming

```css
.component-name           /* Base */
.component-name-title     /* Element */
.component-name.active    /* State */
.component-name:hover     /* Interaction */
```

## Adding styles for a new component

1. Add the rules to the feature's own stylesheet, under a
   `/* --- Component Name --- */` section comment
2. Use variables for every color
3. Include hover, active, and focus states for anything interactive
4. Check it in both themes before committing

## Checklist

- [ ] No color literals — every color is a `var(--*)`
- [ ] Readable in dark **and** light themes
- [ ] Hover, active, and focus states present on interactive elements
- [ ] Transitions are `0.25s ease` unless there is a reason otherwise
- [ ] Layout survives a narrow window and a widened sidebar
- [ ] Focus states are visible for keyboard navigation
