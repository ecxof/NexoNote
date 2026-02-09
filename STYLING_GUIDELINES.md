# NexoNote - Styling Guidelines

## 🎨 Global CSS Variables

All styling uses CSS variables defined in `src/index.css`. To maintain consistency, always use these variables:

```css
/* Backgrounds */
background-color: var(--bg-primary);      /* Main app background */
background-color: var(--bg-secondary);    /* Content backgrounds */
background-color: var(--bg-sidebar);      /* Sidebar background */

/* Text Colors */
color: var(--text-primary);               /* Headings & important text */
color: var(--text-secondary);             /* Body text & descriptions */
color: var(--text-tertiary);              /* Subtle text & placeholders */

/* Accents */
background-color: var(--accent-primary);  /* Primary buttons */
background-color: var(--accent-hover);    /* Button hover state */

/* Borders */
border-color: var(--border-color);        /* Dividers & borders */
```

---

## 📐 Layout Guidelines

### Flexbox Patterns

**Row Layout (Horizontal)**
```css
display: flex;
flex-direction: row;
gap: 1rem;
```

**Column Layout (Vertical)**
```css
display: flex;
flex-direction: column;
gap: 1rem;
```

### Spacing Scale
- **xs**: 0.25rem (4px)
- **sm**: 0.5rem (8px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)
- **2xl**: 3rem (48px)

### Common Spacing Values
```css
padding: 1.5rem;        /* Card padding */
margin-bottom: 2rem;    /* Section spacing */
gap: 2rem;              /* Grid/flex gap */
```

---

## 🔘 Component Classes

### Cards
```css
.card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
}

.card:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
}
```

### Buttons
```css
button {
  background-color: var(--accent-primary);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 0.6rem 1.2rem;
  transition: all 0.25s ease;
}

button:hover {
  background-color: var(--accent-hover);
  transform: translateY(-2px);
}
```

### Menu Items
```css
.sidebar-menu-link {
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

---

## 📱 Responsive Design

### Grid Breakpoints
```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}
```

This creates:
- **3 columns** on large screens (1200px+)
- **2 columns** on tablets (768px+)
- **1 column** on mobile (<768px)

---

## 🎬 Animations & Transitions

### Standard Transition
```css
transition: all 0.25s ease;
```

### Common Animation Patterns

**Hover Lift Effect**
```css
:hover {
  transform: translateY(-2px);
}
```

**Border Color Change**
```css
border-color: var(--border-color);
transition: border-color 0.25s ease;

:hover {
  border-color: var(--accent-primary);
}
```

**Shadow Effect**
```css
box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
```

---

## ✍️ Typography

### Heading Scale
```css
h1 {
  font-size: 2.5rem;
  font-weight: 600;
}

h2 {
  font-size: 2rem;
  font-weight: 600;
}

h3 {
  font-size: 1.5rem;
  font-weight: 500;
}
```

### Text Sizes
```css
.text-base { font-size: 1rem; }
.text-sm { font-size: 0.95rem; }
.text-xs { font-size: 0.85rem; }
```

### Font Weights
```css
font-weight: 400;  /* Regular body text */
font-weight: 500;  /* Medium - labels, buttons */
font-weight: 600;  /* Semi-bold - headings */
font-weight: 700;  /* Bold - emphasized text */
```

---

## 🔧 Adding New Components

When creating new components:

1. **Use CSS Classes** - Avoid inline styles except for dynamic values
2. **Follow Naming Convention** - Use BEM if needed: `.component-name`, `.component-name__element`
3. **Use CSS Variables** - Always reference color/spacing variables
4. **Add Styles to App.css** - Place component styles in the main stylesheet
5. **Include Hover States** - Make interactive elements provide visual feedback
6. **Maintain Dark Theme** - Ensure all text is readable on dark backgrounds

---

## 🎨 Example: Creating a New Component

### React Component (`NewComponent.jsx`)
```jsx
function NewComponent() {
  return (
    <div className="new-component">
      <h3 className="new-component-title">Title</h3>
      <p className="new-component-description">Description</p>
      <button>Action</button>
    </div>
  );
}

export default NewComponent;
```

### CSS Styles (`App.css`)
```css
.new-component {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.new-component:hover {
  border-color: var(--accent-primary);
}

.new-component-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.new-component-description {
  color: var(--text-secondary);
  margin-bottom: 1rem;
}
```

---

## 📚 Additional Resources

- **CSS Variables Reference**: Check `src/index.css` for all available variables
- **Component Examples**: See `src/components/Sidebar.jsx` and `src/components/MainContent.jsx`
- **Layout Examples**: Check `App.css` for layout patterns

---

**Last Updated**: February 5, 2026  
**Maintained by**: NexoNote Development Team
