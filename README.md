# 📚 NexoNote - Desktop Study Application

> A modern, beautiful desktop study application built with React, Electron, SQLite, and Python ML integration.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Status](https://img.shields.io/badge/status-Active%20Development-green)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

## 🎯 Overview

NexoNote is a comprehensive study companion designed to help students organize their learning, track progress, and optimize their study techniques using machine learning insights.

### Key Features
- 📝 **Smart Note-Taking** - Organize notes by subject and topic
- 📊 **Learning Analytics** - Track study time, sessions, and progress
- 📅 **Study Scheduling** - Plan and manage your study sessions
- 🤖 **AI-Powered Insights** - Get personalized study recommendations (Coming Soon)
- 🔐 **Local First** - All data stored locally with SQLite
- 🌙 **Dark Mode** - Premium dark theme optimized for studying

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

### Current Stack
- **Frontend**: React 19.2.0
- **Build Tool**: Vite 7.2.4
- **Styling**: Modern CSS (Flexbox, Grid, Variables)
- **State Management**: React Hooks

### Planned Stack
- **Desktop**: Electron
- **Database**: SQLite
- **Python Integration**: scikit-learn, pandas, numpy
- **Routing**: React Router
- **State Management**: Context API / Redux

---

## 🏗️ Project Structure

```
nexonote/
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx          # Navigation sidebar
│   │   └── MainContent.jsx      # Dashboard area
│   ├── App.jsx                  # Root component
│   ├── App.css                  # Component styles
│   ├── index.css                # Global styles & colors
│   └── main.jsx                 # Entry point
├── public/                      # Static assets
├── ARCHITECTURE.md              # Detailed architecture guide
├── PROJECT_SETUP.md             # Setup documentation
├── STYLING_GUIDELINES.md        # CSS guidelines
├── QUICK_START.md               # Quick reference
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
# Development
npm run dev          # Start Vite dev server

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
```

---

## 📚 Documentation

We provide comprehensive documentation for all aspects of the project:

1. **[QUICK_START.md](./QUICK_START.md)** - Get started in 5 minutes
2. **[PROJECT_SETUP.md](./PROJECT_SETUP.md)** - Complete setup guide
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture & design
4. **[STYLING_GUIDELINES.md](./STYLING_GUIDELINES.md)** - CSS best practices

---

## 🏠 Home Screen Components

### Sidebar Navigation
- NexoNote logo with tagline
- 6 navigation items (Home, Notes, Subjects, Schedule, Analytics, Settings)
- Active state highlighting
- User profile section

### Main Dashboard
- Welcome header with greeting
- 6 responsive dashboard cards:
  1. **Quick Start** - Begin study sessions
  2. **Recent Notes** - Access study materials
  3. **Today's Schedule** - View daily plan
  4. **This Week** - Learning statistics
  5. **Active Subjects** - Manage subjects
  6. **Resources** - Quick access links

---

## 🎯 Features

### ✅ Implemented
- [x] Dark theme design system
- [x] Responsive layout (Flexbox)
- [x] Sidebar navigation with active states
- [x] Dashboard card grid
- [x] CSS variables for theming
- [x] Smooth transitions and hover effects
- [x] Custom scrollbars
- [x] Typography hierarchy

### 🔄 In Progress
- [ ] React Router integration
- [ ] Electron desktop setup
- [ ] SQLite database connection

### 📋 Upcoming
- [ ] Note-taking functionality
- [ ] Subject management
- [ ] Study scheduling
- [ ] Analytics dashboard
- [ ] Python ML integration
- [ ] User authentication

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

### Build for Production
```bash
npm run build
```

This creates an optimized build in the `dist/` directory.

### Electron Integration (Coming Soon)
```bash
npm install electron --save-dev
# Then configure electron main process
```

### Python Backend (Coming Soon)
```bash
pip install scikit-learn pandas numpy
# Set up Python server for ML features
```

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

### Phase 1: MVP (Current)
- ✅ Home screen UI
- ⏳ Basic navigation
- ⏳ Note creation

### Phase 2: Core Features
- React Router setup
- Notes management
- Subject organization
- Schedule planning

### Phase 3: Integration
- Electron desktop app
- SQLite database
- Data persistence

### Phase 4: Intelligence
- Python backend
- ML-based analytics
- Study recommendations
- Pattern analysis

### Phase 5: Polish
- Enhanced UI/UX
- Performance optimization
- User authentication
- Cloud sync (optional)

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
**Last Updated**: February 5, 2026  
**Version**: 1.0.0  

Enjoy studying smarter with NexoNote! 🎓

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
