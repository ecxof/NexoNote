# 🎨 NexoNote - Visual Style Reference

## Color Codes Quick Reference

### Primary Colors
```
Background (Primary):      #0f172a
Background (Secondary):    #111827  
Sidebar Background:        #13161C
Accent (Primary):          #2563EB
Accent (Hover):            #1d4ed8
```

### Text Colors
```
Text (Primary/Headings):   #ffffff
Text (Body):               #9ca3af
Text (Subtle):             #6b7280
Border/Divider:            #1f2937
```

### CSS Variable Names
```css
--bg-primary
--bg-secondary
--bg-sidebar
--accent-primary
--accent-hover
--text-primary
--text-secondary
--text-tertiary
--border-color
```

---

## Typography Scale

### Headings
- **H1**: 2.5rem (40px), weight 600
- **H2**: 2rem (32px), weight 600
- **H3**: 1.5rem (24px), weight 500

### Body Text
- **Regular**: 1rem (16px), weight 400
- **Emphasis**: 1rem, weight 500
- **Small**: 0.95rem (15px)
- **Tiny**: 0.85rem (13.6px)

### Font Stack
```
system-ui, 'Segoe UI', Avenir, Helvetica, Arial, sans-serif
```

---

## Spacing Scale

| Size | Value | Usage |
|------|-------|-------|
| xs | 0.25rem (4px) | Tiny gaps |
| sm | 0.5rem (8px) | Small gaps |
| md | 1rem (16px) | Standard padding |
| lg | 1.5rem (24px) | Large sections |
| xl | 2rem (32px) | Major sections |
| 2xl | 3rem (48px) | Large gaps |

### Common Values Used
```css
padding: 1.5rem;          /* Cards */
padding: 2rem;            /* Main content */
margin-bottom: 2rem;      /* Section spacing */
gap: 2rem;                /* Grid gaps */
gap: 1rem;                /* Flex gaps */
```

---

## Component Dimensions

### Sidebar
```css
width: 16rem;             /* 256px */
height: 100%;             /* Full viewport */
padding: 2rem 1.5rem;     /* Vertical/Horizontal */
```

### Cards
```css
border-radius: 8px;
padding: 1.5rem;
gap: 2rem;                /* Between cards */
min-width: 300px;         /* Grid minimum */
```

### Buttons
```css
border-radius: 6px;
padding: 0.6rem 1.2rem;
height: auto;
width: 100%;              /* In cards */
```

---

## Interactions & Animations

### Transition Standard
```css
transition: all 0.25s ease;
```

### Hover Effects
```css
/* Lift effect */
transform: translateY(-2px);

/* Color change */
border-color: var(--accent-primary);
color: var(--text-primary);

/* Background */
background-color: var(--accent-hover);
```

### Active State
```css
background-color: var(--accent-primary);
color: var(--text-primary);
```

### Focus State
```css
outline: 2px solid var(--accent-primary);
outline-offset: 2px;
```

---

## Shadows & Depth

### Card Hover Shadow
```css
box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
```

### No Default Shadow
Cards start flat, only add shadow on hover for performance.

---

## Responsive Breakpoints

### Mobile First Approach
```css
/* Default: Mobile (<768px) */
.dashboard-grid {
  grid-template-columns: 1fr;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop (1200px+) */
@media (min-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Key Breakpoints
- **Tablet**: 768px
- **Desktop**: 1200px
- **Large Desktop**: 1920px (optional)

---

## Component Library Reference

### Sidebar Navigation Item
```css
.sidebar-menu-link {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.sidebar-menu-link:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.sidebar-menu-link.active {
  background-color: var(--accent-primary);
  color: var(--text-primary);
}
```

### Dashboard Card
```css
.card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.card:hover {
  border-color: var(--accent-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
}
```

### Primary Button
```css
button {
  background-color: var(--accent-primary);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 0.6rem 1.2rem;
  transition: all 0.25s ease;
  font-weight: 500;
}

button:hover {
  background-color: var(--accent-hover);
  transform: translateY(-2px);
}
```

---

## Contrast & Accessibility

### WCAG AA Compliance
- White text on dark backgrounds: ✅ 18:1 contrast ratio
- Gray text on dark backgrounds: ✅ 7:1 contrast ratio
- Blue accents meet accessibility standards: ✅

### Readability
- Line height: 1.5 (optimal for reading)
- Maximum line width: Naturally limited by card width
- Proper font weights for hierarchy

---

## Icons & Visual Elements

### Emoji Icons (Used in Navigation)
```
📚 Home/Notes
📝 Notes
📖 Subjects
📅 Schedule
📊 Analytics
⚙️ Settings
👤 Profile
```

### Sizing Icons
```css
font-size: 1.2rem;        /* Navigation icons */
font-size: 2rem;          /* Card titles */
margin-right: 0.75rem;    /* Icon spacing */
```

---

## Common Patterns

### Flexbox Row (Horizontal)
```css
display: flex;
flex-direction: row;
align-items: center;
gap: 1rem;
```

### Flexbox Column (Vertical)
```css
display: flex;
flex-direction: column;
gap: 1rem;
```

### Grid Layout (Auto-fit)
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
gap: 2rem;
```

### Centered Content
```css
display: flex;
justify-content: center;
align-items: center;
```

---

## Customization Guide

### Change Accent Color
Edit `src/index.css`:
```css
:root {
  --accent-primary: #YOUR_COLOR;
  --accent-hover: #DARKER_SHADE;
}
```

### Change Background
Edit `src/index.css`:
```css
:root {
  --bg-primary: #YOUR_COLOR;
  --bg-secondary: #LIGHTER_SHADE;
}
```

### Change Text Color
Edit `src/index.css`:
```css
:root {
  --text-primary: #YOUR_COLOR;
  --text-secondary: #LIGHTER_SHADE;
}
```

### Adjust Sidebar Width
Edit `src/App.css`:
```css
.sidebar {
  width: 18rem;  /* Change from 16rem */
}
```

### Modify Card Spacing
Edit `src/App.css`:
```css
.dashboard-grid {
  gap: 3rem;  /* Change from 2rem */
}
```

---

## Dark Mode Best Practices

### ✅ DO
- Use dark backgrounds to reduce eye strain
- Provide sufficient contrast (7:1 minimum)
- Use cooler accent colors with dark backgrounds
- Darken hover states (not lighten)
- Use subtle shadows on dark backgrounds

### ❌ DON'T
- Use pure white text on pure black
- Use overly bright accent colors
- Lighten colors on hover
- Use high saturation colors
- Create harsh contrast that causes discomfort

---

## Testing Your Styles

### Visual Testing Checklist
- [ ] All text is readable
- [ ] Hover effects work smoothly
- [ ] Active states are clear
- [ ] Colors are consistent
- [ ] Spacing is even
- [ ] Responsive layout works
- [ ] Scrollbars are visible
- [ ] Transitions are smooth

### Browser Testing
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Focus states are visible
- [ ] Color contrast is sufficient
- [ ] Text is readable
- [ ] No motion sickness triggers

---

## Performance Tips

### CSS Optimization
- ✅ Use CSS variables (no JavaScript needed)
- ✅ Use CSS Grid (minimal JavaScript)
- ✅ Use Flexbox (native support)
- ✅ Use transitions (GPU accelerated)
- ✅ Avoid expensive transforms

### Rendering Performance
- ✅ CSS variables don't trigger repaints
- ✅ Transitions use GPU acceleration
- ✅ No JavaScript animations
- ✅ Minimal DOM manipulation
- ✅ Efficient component structure

---

## File Organization

### CSS Files Location
```
src/
├── index.css      # Global styles, variables, typography
└── App.css        # Component-specific styles
```

### What Goes Where
- **index.css**: Colors, fonts, base elements, global styles
- **App.css**: Component layouts, interactions, responsive

### CSS Variable Usage
```css
/* In index.css - Define */
:root {
  --bg-primary: #0f172a;
}

/* In App.css - Use */
.sidebar {
  background-color: var(--bg-sidebar);
}
```

---

## Color Harmony

### The Palette Works Because:
- **Dark backgrounds**: Reduce eye strain, perfect for study apps
- **Cool blue accents**: Professional, trustworthy, calming
- **High contrast text**: Ensures readability
- **Subtle borders**: Define sections without overwhelm
- **Consistent palette**: Creates cohesive experience

### Psychology
- **Dark**: Focuses attention, reduces distractions
- **Blue**: Promotes calmness, concentration
- **White text**: Maximum readability
- **Gray text**: Subtle, not distracting

---

## Export & Share

### Colors as Design Tokens
```json
{
  "colors": {
    "bg": {
      "primary": "#0f172a",
      "secondary": "#111827",
      "sidebar": "#13161C"
    },
    "accent": {
      "primary": "#2563EB",
      "hover": "#1d4ed8"
    },
    "text": {
      "primary": "#ffffff",
      "secondary": "#9ca3af",
      "tertiary": "#6b7280"
    }
  }
}
```

---

**Last Updated**: February 5, 2026  
**Version**: 1.0  
**Status**: Production Ready
