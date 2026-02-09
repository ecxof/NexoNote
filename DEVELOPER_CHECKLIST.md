# ⚡ NexoNote - Developer Quick Checklist

## Before Starting Work

### Daily Setup (30 seconds)
```bash
# 1. Navigate to project
cd "E:\My Programming Projects\nexonote"

# 2. Start dev server
npm run dev

# 3. Open in browser
http://localhost:5173
```

### Weekly Checklist
- [ ] Pull latest changes
- [ ] Run `npm lint` for code quality
- [ ] Review documentation if needed
- [ ] Update progress in SETUP_CHECKLIST.md

---

## Code Standards

### When Writing React Code
- [ ] Use functional components
- [ ] Use React hooks (useState, useEffect, etc.)
- [ ] Import CSS files at component level
- [ ] Add proper JSX formatting
- [ ] Use semantic HTML
- [ ] Add comments for complex logic

### When Writing CSS
- [ ] Use CSS variables for colors
- [ ] Follow BEM naming (if needed)
- [ ] Add transitions for interactions
- [ ] Test responsive design
- [ ] Check color contrast
- [ ] Ensure dark theme compatibility

### Styling Checklist
- [ ] Colors use `var(--*)` variables
- [ ] No hardcoded color values
- [ ] Flexbox/Grid used correctly
- [ ] Responsive breakpoints tested
- [ ] Hover states implemented
- [ ] Active states implemented
- [ ] Transitions smooth (0.25s ease)
- [ ] Scrollbars styled

---

## File Organization

### Component File Template
```jsx
import { useState } from 'react';

function ComponentName() {
  // State
  const [state, setState] = useState(initialValue);

  // Handlers
  const handleEvent = () => {
    // Handle event
  };

  // Render
  return (
    <div className="component-name">
      {/* JSX here */}
    </div>
  );
}

export default ComponentName;
```

### CSS Class Naming
```css
/* Base component */
.component-name {
  /* styles */
}

/* Element */
.component-name-title {
  /* styles */
}

/* State/Modifier */
.component-name.active {
  /* styles */
}

/* Hover */
.component-name:hover {
  /* styles */
}
```

---

## Common Tasks

### Add a New Component
```bash
# 1. Create file in src/components/
touch src/components/YourComponent.jsx

# 2. Add to App.css
# Add .your-component class styles

# 3. Import in App.jsx or parent
import YourComponent from './components/YourComponent'

# 4. Use in render
<YourComponent />
```

### Change a Color
```css
/* In src/index.css, find :root section */
:root {
  --accent-primary: #NEW_COLOR;
}
```

### Make Something Responsive
```css
/* Mobile first, then add breakpoints */
.dashboard-grid {
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Add Hover Effect
```css
.my-component {
  transition: all 0.25s ease;
}

.my-component:hover {
  color: var(--accent-primary);
  transform: translateY(-2px);
}
```

---

## Testing Checklist

### Before Committing
- [ ] Run `npm run lint`
- [ ] No console errors
- [ ] No console warnings
- [ ] Component renders correctly
- [ ] Hover effects work
- [ ] Responsive design works
- [ ] Colors are correct
- [ ] Text is readable

### Visual Testing
- [ ] Desktop view (1920px)
- [ ] Tablet view (768px)
- [ ] Mobile view (375px)
- [ ] Dark theme looks good
- [ ] All interactive elements respond

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Focus states are visible
- [ ] Text contrast is sufficient
- [ ] Semantic HTML used
- [ ] No flashing content

---

## Troubleshooting

### Dev Server Won't Start
```bash
# Check port is free
# Kill previous process
# Try different port
npm run dev -- --port 3000
```

### Styles Not Updating
```bash
# 1. Save the file again
# 2. Hard refresh browser (Ctrl+Shift+R)
# 3. Clear browser cache
# 4. Restart dev server
```

### Component Not Showing
```bash
# 1. Check import path
# 2. Check className spelling
# 3. Check CSS exists
# 4. Check console for errors
```

### Wrong Colors
```bash
# 1. Check CSS variable name
# 2. Check index.css for variable definition
# 3. Check browser CSS panel
# 4. Clear CSS cache
```

---

## Performance Tips

### CSS Performance
✅ Use CSS variables (no JS overhead)  
✅ Use CSS Grid/Flexbox (native)  
✅ Use transitions (GPU accelerated)  
✅ Minimize selectors (no deep nesting)  
✅ Use class selectors (most efficient)  

### React Performance
✅ Avoid unnecessary re-renders  
✅ Use proper key prop in lists  
✅ Memoize expensive components  
✅ Code split with React.lazy()  
✅ Optimize bundle size  

### Browser Performance
✅ Minimize repaints
✅ Minimize reflows
✅ Use requestAnimationFrame
✅ Debounce event handlers
✅ Lazy load images

---

## Git Workflow

### Before Pushing
```bash
# 1. Check status
git status

# 2. Stage changes
git add .

# 3. Commit with message
git commit -m "Add feature: description"

# 4. Push to branch
git push origin branch-name
```

### Commit Message Format
```
feat: Add new feature
fix: Fix bug in component
docs: Update documentation
style: Format code
refactor: Restructure code
test: Add tests
```

---

## Documentation Updates

### When to Update Docs
- [ ] After adding new component
- [ ] After changing colors
- [ ] After changing layout
- [ ] After adding new feature
- [ ] After major refactor

### Which Files to Update
- [x] README.md (features list)
- [x] PROJECT_SETUP.md (new components)
- [x] ARCHITECTURE.md (structure changes)
- [x] STYLING_GUIDELINES.md (new patterns)
- [x] COLOR_AND_STYLE_REFERENCE.md (color changes)

---

## Browser DevTools Tips

### Inspect Element
- [ ] Check computed styles
- [ ] Verify CSS variables applied
- [ ] Check element hierarchy
- [ ] Verify classes applied

### Console
- [ ] Check for errors
- [ ] Check for warnings
- [ ] Log component state
- [ ] Test JavaScript

### Performance
- [ ] Check render times
- [ ] Monitor repaints
- [ ] Check bundle size
- [ ] Profile components

### Responsive Design
- [ ] Test all breakpoints
- [ ] Check orientation changes
- [ ] Verify touch interactions
- [ ] Test zoom levels

---

## Quick Reference Cards

### CSS Variables
```css
Colors:
--bg-primary: #0f172a
--bg-secondary: #111827
--accent-primary: #2563EB
--text-primary: #ffffff
--text-secondary: #9ca3af
--border-color: #1f2937
```

### Spacing Values
```css
xs: 0.25rem (4px)
sm: 0.5rem (8px)
md: 1rem (16px)
lg: 1.5rem (24px)
xl: 2rem (32px)
2xl: 3rem (48px)
```

### Font Sizes
```css
h1: 2.5rem (40px)
h2: 2rem (32px)
h3: 1.5rem (24px)
body: 1rem (16px)
small: 0.95rem (15px)
tiny: 0.85rem (13.6px)
```

### Breakpoints
```css
Mobile: < 768px
Tablet: 768px - 1200px
Desktop: 1200px+
```

---

## Keyboard Shortcuts

### Editor Shortcuts
- Ctrl+S - Save file
- Ctrl+/ - Toggle comment
- Ctrl+D - Select word
- Ctrl+Shift+L - Select all matches
- Ctrl+H - Find and replace

### Browser Shortcuts
- F12 - DevTools
- Ctrl+Shift+I - Inspector
- Ctrl+Shift+C - Element picker
- Ctrl+Shift+K - Console
- Ctrl+Shift+R - Hard refresh

### Terminal Shortcuts
- Ctrl+C - Stop process
- Ctrl+L - Clear screen
- Up Arrow - Previous command
- Ctrl+R - Search history

---

## Common Patterns

### Flexbox Row
```jsx
<div style={{ display: 'flex', gap: '1rem' }}>
  {/* items */}
</div>
```

### Flexbox Column
```jsx
<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
  {/* items */}
</div>
```

### Grid Layout
```jsx
<div className="dashboard-grid">
  {/* cards */}
</div>
```

### Hover Effect
```css
.element {
  transition: all 0.25s ease;
}
.element:hover {
  transform: translateY(-2px);
  color: var(--accent-primary);
}
```

---

## Resources

### Documentation
- README.md - Project overview
- ARCHITECTURE.md - System design
- STYLING_GUIDELINES.md - CSS guide
- COLOR_AND_STYLE_REFERENCE.md - Colors

### Tools
- Vite - Build tool
- React - UI framework
- ESLint - Code quality
- DevTools - Browser debugging

### References
- MDN - Web standards
- React docs - React API
- CSS tricks - CSS guide
- Can I Use - Browser support

---

## Checklist for Pull Requests

Before submitting PR:
- [ ] Code follows style guide
- [ ] ESLint passes (`npm run lint`)
- [ ] No console errors
- [ ] No console warnings
- [ ] Responsive design tested
- [ ] Dark theme verified
- [ ] Colors use variables
- [ ] Documentation updated
- [ ] Commit messages clear
- [ ] Tests pass (if applicable)

---

## End of Day Checklist

Before closing for the day:
- [ ] Save all files
- [ ] Commit changes
- [ ] Push to repository
- [ ] Note what's done in SETUP_CHECKLIST.md
- [ ] Update any blocked items
- [ ] Clean up workspace
- [ ] Close dev server (Ctrl+C)

---

## Weekly Review

Every Friday:
- [ ] Review completed features
- [ ] Update SETUP_CHECKLIST.md
- [ ] Check documentation is current
- [ ] Plan next week's work
- [ ] Test on multiple browsers
- [ ] Check performance metrics
- [ ] Review code quality

---

## Emergency Procedures

### If styles break
```bash
# 1. Check App.css for syntax errors
# 2. Check index.css for variable errors
# 3. Hard refresh browser
# 4. Restart dev server
# 5. Check browser console
```

### If component breaks
```bash
# 1. Check for import errors
# 2. Check JSX syntax
# 3. Check console for errors
# 4. Revert recent changes
# 5. Restore from git
```

### If dev server crashes
```bash
# 1. Stop with Ctrl+C
# 2. Check for syntax errors
# 3. Clear npm cache
# 4. Delete node_modules
# 5. Reinstall: npm install
# 6. Try again: npm run dev
```

---

## Productivity Tips

### Speed Up Development
1. Keep documentation open
2. Use editor shortcuts
3. Keep dev tools visible
4. Use quick reference cards
5. Automate repetitive tasks

### Stay Organized
1. Commit frequently
2. Write clear messages
3. Keep branches clean
4. Update docs regularly
5. Review code carefully

### Avoid Common Mistakes
1. ❌ Hardcoding colors (use variables!)
2. ❌ Forgetting responsive design
3. ❌ Not testing accessibility
4. ❌ Skipping documentation
5. ❌ Not testing across browsers

---

## Success Metrics

### Code Quality
- ✅ ESLint passes
- ✅ No console errors
- ✅ No console warnings
- ✅ Tests pass
- ✅ Performance good

### User Experience
- ✅ Responsive design
- ✅ Fast load time
- ✅ Smooth animations
- ✅ Clear navigation
- ✅ Accessible UI

### Maintainability
- ✅ Code documented
- ✅ Clear naming
- ✅ DRY principles
- ✅ SOLID principles
- ✅ Best practices

---

**Created**: February 5, 2026  
**Purpose**: Daily development reference  
**Status**: Ready to use

**Happy coding! 🚀**
