# 🚀 NexoNote - Quick Start Guide

## 📖 Getting Started

### Prerequisites
- Node.js (v18 or higher) - Already installed ✓
- npm (v10 or higher) - Already installed ✓

### Commands

```bash
# 1. Install dependencies (if needed)
npm install

# 2. Start development server
npm run dev

# 3. Open browser
# Navigate to: http://localhost:5173

# 4. Build for production
npm run build

# 5. Preview production build
npm run preview
```

---

## 🎨 The UI You'll See

### Sidebar (Left - 256px wide)
- **NexoNote** logo with "Study Smart" tagline
- **Navigation Menu** (6 items):
  - Home 📚 (currently active)
  - Notes 📝
  - Subjects 📖
  - Schedule 📅
  - Analytics 📊
  - Settings ⚙️
- **Profile Section** at the bottom (👤)

### Main Content Area
- **Welcome Header** with greeting and subtitle
- **6 Dashboard Cards** in responsive grid:
  1. Quick Start - "Start Studying" button
  2. Recent Notes - "No recent notes yet"
  3. Today's Schedule - "View Schedule" button
  4. This Week - Stats showing 0 hours & 0 sessions
  5. Active Subjects - "Create Subject" button
  6. Resources - "No resources added yet"

---

## 🎨 Styling

All colors are defined as CSS variables in `src/index.css`:

```css
--bg-primary: #0f172a          /* Main background */
--bg-sidebar: #13161C          /* Sidebar background */
--accent-primary: #2563EB      /* Blue buttons/active states */
--text-primary: #ffffff        /* Headings */
--text-secondary: #9ca3af      /* Body text */
```

To change the theme, modify these variables!

---

## 📂 File Structure

```
src/
├── App.jsx              # Root component
├── App.css              # Layout & component styles
├── index.css            # Global styles & color variables
├── main.jsx             # Entry point
└── components/
    ├── Sidebar.jsx      # Navigation sidebar
    └── MainContent.jsx  # Dashboard area
```

---

## 🔧 Customization Tips

### Change Colors
Edit `src/index.css` at the top:
```css
:root {
  --bg-primary: #0f172a;
  --accent-primary: #2563EB;
  /* ... change any color here ... */
}
```

### Add New Menu Items
Edit `src/components/Sidebar.jsx`:
```jsx
const menuItems = [
  { id: 'home', label: 'Home', icon: '📚' },
  // Add new items here
  { id: 'newpage', label: 'New Page', icon: '🆕' },
];
```

### Add Dashboard Cards
Edit `src/components/MainContent.jsx` - add new card divs inside `.dashboard-grid`

### Modify Sidebar Width
Edit `src/App.css`:
```css
.sidebar {
  width: 16rem; /* Change this value (currently 256px) */
}
```

---

## 🎯 Next Steps

1. **Explore the UI** - Run `npm run dev` and see the app
2. **Try Hovering** - Hover over menu items and cards to see effects
3. **Read Comments** - Check the component files for inline documentation
4. **Review Styles** - Check `STYLING_GUIDELINES.md` for patterns
5. **Start Building** - Add more components and pages!

---

## 📞 Common Issues

### Port Already In Use
If port 5173 is already in use:
```bash
npm run dev -- --port 3000
```

### Dependencies Not Installing
```bash
# Clear cache and reinstall
npm cache clean --force
rm -r node_modules
npm install
```

### Changes Not Appearing
- Vite has hot module replacement - changes auto-refresh
- If not working, save the file again
- Clear browser cache if needed

---

## 🎓 Code Structure Overview

### App.jsx (Root Component)
```jsx
<div className="app-container">
  <Sidebar />        {/* Navigation */}
  <MainContent />    {/* Main dashboard */}
</div>
```

### Sidebar.jsx (Navigation)
- Uses React state to track active menu item
- Click handlers update active state
- Classes change based on active state
- Fully styled with CSS

### MainContent.jsx (Dashboard)
- Clean HTML structure
- Uses CSS Grid for responsive card layout
- Card components for quick access
- Button placeholders for future functionality

---

## 📚 Documentation

- **PROJECT_SETUP.md** - Detailed setup guide
- **STYLING_GUIDELINES.md** - CSS best practices and patterns
- This file - Quick reference

---

## 🎉 You're All Set!

Your NexoNote Home Screen is ready to use and expand. The foundation is solid, the design is beautiful, and the code is clean.

**Start building amazing features! 🚀**

---

**Created**: February 5, 2026  
**Version**: 1.0  
**Status**: Production Ready
