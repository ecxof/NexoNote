# 🏗️ NexoNote Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NexoNote Application                      │
│                  (React + Vite + Electron)                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      index.html (Entry)                      │
│                    <div id="root"></div>                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    main.jsx (Bootstrap)                      │
│              ReactDOM.createRoot(App Component)              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    App.jsx (Root Component)                  │
│                  <div className="app-container">             │
│                     <Sidebar />                              │
│                     <MainContent />                          │
└─────────────────────────────────────────────────────────────┘
         ↓                                      ↓
    ┌────────────────┐              ┌──────────────────────┐
    │   Sidebar.jsx  │              │ MainContent.jsx      │
    ├────────────────┤              ├──────────────────────┤
    │ - Logo Section │              │ - Welcome Header     │
    │ - Nav Menu (6) │              │ - Dashboard Grid     │
    │ - Profile Link │              │ - 6 Card Components  │
    │ - Active State │              │ - Responsive Layout  │
    └────────────────┘              └──────────────────────┘
         ↓                                      ↓
    CSS: App.css                          CSS: App.css
    Colors: index.css                     Colors: index.css
```

---

## Component Hierarchy

```
App
├── Sidebar (Fixed 256px width)
│   ├── Header Section
│   │   ├── Logo (NexoNote)
│   │   └── Tagline (Study Smart)
│   ├── Navigation Menu
│   │   ├── Home (Active)
│   │   ├── Notes
│   │   ├── Subjects
│   │   ├── Schedule
│   │   ├── Analytics
│   │   └── Settings
│   └── Profile Section
│       └── User Avatar
│
└── MainContent (Flex-grow, Scrollable)
    ├── Welcome Header
    │   ├── Title (Welcome Back!)
    │   └── Subtitle (Learning journey)
    │
    └── Dashboard Grid (Auto-fit layout)
        ├── Card 1: Quick Start
        │   └── Button: Start Studying
        ├── Card 2: Recent Notes
        │   └── Empty State: No recent notes
        ├── Card 3: Today's Schedule
        │   └── Button: View Schedule
        ├── Card 4: This Week (Stats)
        │   ├── Hours Studied: 0
        │   └── Sessions: 0
        ├── Card 5: Active Subjects
        │   └── Button: Create Subject
        └── Card 6: Resources
            └── Empty State: No resources
```

---

## Layout Visualization

```
┌──────────────────────────────────────────────────────────┐
│  HEADER (Not implemented yet)                            │
└──────────────────────────────────────────────────────────┘
┌─────────────────┬──────────────────────────────────────┐
│                 │                                      │
│   SIDEBAR       │      MAIN CONTENT AREA              │
│   (256px)       │      (Flex-grow)                     │
│                 │                                      │
│  ┌──────────┐   │  Welcome Back! 🎉                   │
│  │ NexoNote │   │  Study Smart Subtitle                │
│  │Study     │   │                                      │
│  │Smart     │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  └──────────┘   │  │ Quick   │ │ Recent  │ │ Today's ││
│                 │  │ Start   │ │ Notes   │ │ Schedule││
│  ┌──────────┐   │  └─────────┘ └─────────┘ └─────────┘│
│  │📚 Home   │   │                                      │
│  │📝 Notes  │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │📖 Subj. │   │  │ This    │ │ Active  │ │Resources││
│  │📅 Sched │   │  │ Week    │ │ Subjects│ │         ││
│  │📊 Analyt│   │  └─────────┘ └─────────┘ └─────────┘│
│  │⚙️ Settings   │                                      │
│  └──────────┘   │  (Scrollable Area ↓)                │
│                 │                                      │
│  [👤 Profile]   │                                      │
│                 │                                      │
└─────────────────┴──────────────────────────────────────┘
```

---

## File Dependencies

```
src/
├── main.jsx
│   └── imports: App.jsx
│
├── App.jsx
│   ├── imports: ./App.css
│   ├── imports: ./components/Sidebar.jsx
│   └── imports: ./components/MainContent.jsx
│
├── App.css
│   └── depends on: index.css (CSS variables)
│
├── index.css
│   └── defines: All CSS variables and global styles
│
├── components/
│   ├── Sidebar.jsx
│   │   └── imports: React.useState
│   │       uses: .sidebar, .sidebar-menu-link classes from App.css
│   │
│   └── MainContent.jsx
│       └── uses: .main-content, .dashboard-grid, .card classes from App.css
│
└── index.html
    └── root: <div id="root"></div>
```

---

## Color Flow

```
CSS Variables (index.css)
├── Backgrounds
│   ├── --bg-primary: #0f172a
│   ├── --bg-secondary: #111827
│   └── --bg-sidebar: #13161C
├── Text
│   ├── --text-primary: #ffffff
│   ├── --text-secondary: #9ca3af
│   └── --text-tertiary: #6b7280
├── Accents
│   ├── --accent-primary: #2563EB
│   └── --accent-hover: #1d4ed8
└── Borders
    └── --border-color: #1f2937
         ↓
    Applied across all components
         ↓
    Sidebar, Cards, Buttons, Text
         ↓
    Consistent dark theme throughout
```

---

## State Management

### Current State
```jsx
Sidebar.jsx:
  - activeItem: 'home' (local state)
  - Updates on menu click
  - Changes active class on sidebar-menu-link
```

### Future State (When Needed)
```jsx
App.jsx:
  - Could use Context API for shared state
  - Or Redux for complex state
  - Pass activeItem down as prop
  - Handle navigation globally
```

---

## CSS Structure

```
index.css
├── :root (CSS variables)
├── * (box-sizing)
├── body (dark background)
├── #root (flex container)
├── Typography (h1, h2, h3, p)
├── Links (a, a:hover)
└── Buttons (button styles)

App.css
├── .app-container (flex layout)
├── .sidebar (fixed width sidebar)
│   ├── .sidebar-header
│   ├── .sidebar-logo
│   ├── .sidebar-menu
│   │   ├── .sidebar-menu-item
│   │   └── .sidebar-menu-link
│   │       ├── :hover
│   │       └── .active
│   └── Profile section
├── .main-content (scrollable)
│   ├── .main-content-header
│   ├── .main-content-title
│   ├── .main-content-subtitle
│   └── .dashboard-grid
│       └── .card
│           ├── .card-title
│           ├── .card-description
│           └── .card-footer
└── Scrollbar styling
```

---

## Data Flow

```
User Interaction
    ↓
Sidebar Menu Click
    ↓
setActiveItem('id')
    ↓
Component Re-render
    ↓
className = `sidebar-menu-link ${activeItem === item.id ? 'active' : ''}`
    ↓
CSS applies .active styles
    ↓
Visual update (blue background)
    ↓
User sees highlighted menu item
```

---

## Responsive Behavior

```
Large Screens (1200px+)
└── Dashboard Grid: 3 columns
    ├── Card 1 | Card 2 | Card 3
    └── Card 4 | Card 5 | Card 6

Tablets (768px - 1200px)
└── Dashboard Grid: 2 columns
    ├── Card 1 | Card 2
    ├── Card 3 | Card 4
    └── Card 5 | Card 6

Mobile (<768px)
└── Dashboard Grid: 1 column
    ├── Card 1
    ├── Card 2
    ├── Card 3
    ├── Card 4
    ├── Card 5
    └── Card 6
```

---

## Future Integration Points

```
┌────────────────────────────────────────┐
│        React + Electron Core           │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐ │
│  │    React Frontend (Current)      │ │
│  │  - Sidebar Navigation            │ │
│  │  - Dashboard Cards               │ │
│  └──────────────────────────────────┘ │
│                  ↓                     │
│  ┌──────────────────────────────────┐ │
│  │    React Router (To Add)         │ │
│  │  - Route to Notes page           │ │
│  │  - Route to Subjects page        │ │
│  │  - Route to Schedule page        │ │
│  └──────────────────────────────────┘ │
│                  ↓                     │
│  ┌──────────────────────────────────┐ │
│  │    State Management (To Add)     │ │
│  │  - Context API or Redux          │ │
│  │  - Global app state              │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
            ↓                ↓
   ┌────────────────┐   ┌────────────────┐
   │   Node.js      │   │   Electron     │
   │   Backend      │   │   Main Process │
   │   - API        │   │   - File system│
   │   - Business   │   │   - Native UI  │
   │     Logic      │   │   - OS events  │
   └────────────────┘   └────────────────┘
            ↓                ↓
   ┌────────────────┐   ┌────────────────┐
   │   SQLite       │   │   Python       │
   │   Database     │   │   Backend      │
   │   - Notes      │   │   - scikit-learn
   │   - Subjects   │   │   - Analytics  │
   │   - Schedule   │   │   - ML Models  │
   │   - Analytics  │   │   - Predictions│
   └────────────────┘   └────────────────┘
```

---

## Technology Stack

```
Frontend Layer
├── React 19.2.0 (UI Framework)
├── Vite 7.2.4 (Build Tool)
├── Modern CSS (Styling)
│   ├── Flexbox (Layout)
│   ├── CSS Grid (Dashboard)
│   ├── CSS Variables (Theming)
│   └── Transitions (Animations)
└── JSX (Template Language)

Application Layer (Future)
├── React Router (Navigation)
├── Context API (State)
├── Electron (Desktop)
└── Node.js (Runtime)

Data Layer (Future)
├── SQLite (Local Database)
├── REST API (Communication)
└── File System (Storage)

Analytics Layer (Future)
├── Python 3.x (Data Science)
├── scikit-learn (ML Library)
├── pandas (Data Processing)
└── numpy (Numerical Computing)
```

---

## Performance Considerations

### Current Optimizations
✓ CSS variables for no runtime overhead  
✓ Responsive grid with auto-fit (no hardcoded breakpoints)  
✓ CSS transitions instead of JavaScript animations  
✓ No unnecessary state updates  
✓ Lightweight component structure  

### Future Optimizations
- [ ] Code splitting with React.lazy()
- [ ] Image optimization
- [ ] Lazy loading for dashboard cards
- [ ] Virtual scrolling for large lists
- [ ] Memoization of components
- [ ] Bundle size analysis

---

## Summary

The NexoNote architecture is designed to be:
- **Modular** - Easy to add new components
- **Scalable** - Ready for complex features
- **Maintainable** - Clean, well-organized code
- **Responsive** - Works on all screen sizes
- **Extensible** - Ready for Electron, Python integration
- **Dark-Themed** - Premium, modern look

---

**Architecture Version**: 1.0  
**Last Updated**: February 5, 2026  
**Status**: Complete and Production Ready
