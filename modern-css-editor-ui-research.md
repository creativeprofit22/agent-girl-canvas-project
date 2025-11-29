# Modern CSS Techniques for Beautiful Editor/Canvas UIs (2024-2025)

## Executive Summary

This report synthesizes the latest CSS features and best practices for creating beautiful, accessible, and performant code editor interfaces. Key findings include:

- **Container Queries** have achieved ~93% browser support and revolutionize component-based responsive design
- **OKLCH color space** provides perceptual uniformity superior to RGB/HSL for theme development
- **light-dark() function** simplifies theme switching without JavaScript
- **Scroll-driven animations** enable performant timeline-based effects without layout thrashing
- **WCAG AA compliance** (4.5:1 contrast) is the industry standard, with 83.6% of websites failing this basic requirement

---

## 1. Latest CSS Features for Editor Interfaces (2024-2025)

### Container Queries: Component-Based Responsiveness

**Browser Support:** ~93% as of November 2024 (all major browsers since 2023)

Container queries allow editor components to respond to their parent container size rather than viewport, enabling truly modular, reusable UI components.

#### Basic Implementation

```css
/* Define containment context */
.editor-panel {
  container-name: editor;
  container-type: inline-size;
}

/* Query the container */
@container editor (min-width: 600px) {
  .toolbar {
    flex-direction: row;
  }

  .toolbar-item {
    flex: 0 0 auto;
  }
}

@container editor (max-width: 599px) {
  .toolbar {
    flex-direction: column;
  }

  .toolbar-item {
    width: 100%;
  }
}
```

#### Real-World Editor Examples

From Filament PHP's rich editor:

```css
.fi-fo-rich-editor {
  @supports (container-type: inline-size) {
    container-type: inline-size;

    & .fi-fo-rich-editor-main {
      /* Two-column layout when container is wide */
      @container (min-width: 896px) {
        flex-direction: row;
      }
    }

    & .fi-fo-rich-editor-panels {
      @container (min-width: 896px) {
        max-width: 18rem;
        border-left: 1px solid var(--border-color);
      }
    }
  }

  /* Fallback for older browsers */
  @supports not (container-type: inline-size) {
    & .fi-fo-rich-editor-main {
      @media (min-width: 768px) {
        flex-direction: row;
      }
    }
  }
}
```

#### Container Query Units (CQU)

```css
.editor-sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

/* Font sizes scale with container */
.sidebar-heading {
  font-size: clamp(1rem, 5cqi, 2rem); /* 5% of container inline size */
}

.avatar-fallback {
  font-size: 35cqi; /* Avatar text scales to 35% of container */
  font-weight: 500;
}
```

**Best Practices:**
- Use `container-type: inline-size` for horizontal responsiveness (most common)
- Use `container-type: size` when querying both dimensions (triggers layout containment)
- Convert breakpoints to `rem` units for accessibility (respects user font-size preferences)
- Choose breakpoints based on component needs, not device sizes
- Always provide `@supports` fallbacks for progressive enhancement

---

## 2. Beautiful Syntax Highlighting Color Schemes

### WCAG Contrast Requirements

**Industry Standard:** WCAG AA (4.5:1 for normal text, 3:1 for large text)

**Current State:** 83.6% of websites fail basic contrast requirements (WebAIM 2024)

### Accessible Color Palette Strategy

#### Base16 Approach (WCAG AA Compliant)

Modern editors use Base16 color schemes with 16 carefully selected colors:
- 8 base colors (backgrounds, foregrounds, grays)
- 8 accent colors (syntax highlighting)

**Key Principle:** Every 5 lightness steps = 4.5:1 contrast ratio

```css
:root {
  /* Light theme base colors */
  --base00: oklch(100% 0 0);        /* Background */
  --base01: oklch(95% 0.005 250);   /* Lighter background */
  --base02: oklch(87% 0.01 250);    /* Selection background */
  --base03: oklch(65% 0.02 250);    /* Comments, invisibles */
  --base04: oklch(55% 0.03 250);    /* Dark foreground */
  --base05: oklch(35% 0.02 250);    /* Default foreground */
  --base06: oklch(25% 0.01 250);    /* Light foreground */
  --base07: oklch(15% 0 0);         /* Lighter foreground */

  /* Syntax colors - optimized for WCAG AA */
  --base08: oklch(57.7% 0.245 27.325);  /* Red - Variables, errors */
  --base09: oklch(64.6% 0.222 41.116);  /* Orange - Integers, constants */
  --base0A: oklch(70.5% 0.213 90);      /* Yellow - Classes, search */
  --base0B: oklch(65% 0.17 162.48);     /* Green - Strings */
  --base0C: oklch(62.3% 0.214 200);     /* Cyan - Regex, escape chars */
  --base0D: oklch(62.3% 0.214 259.815); /* Blue - Functions */
  --base0E: oklch(60% 0.20 310);        /* Magenta - Keywords */
  --base0F: oklch(55% 0.195 38.402);    /* Brown - Deprecated */
}
```

#### Dark Theme Variant

```css
[data-theme="dark"] {
  /* Dark theme base colors */
  --base00: oklch(20% 0.01 250);    /* Background */
  --base01: oklch(25% 0.015 250);   /* Lighter background */
  --base02: oklch(30% 0.02 250);    /* Selection background */
  --base03: oklch(45% 0.03 250);    /* Comments */
  --base04: oklch(60% 0.04 250);    /* Dark foreground */
  --base05: oklch(80% 0.02 250);    /* Default foreground */
  --base06: oklch(90% 0.01 250);    /* Light foreground */
  --base07: oklch(95% 0 0);         /* Lighter foreground */

  /* Syntax colors - adjusted for dark background */
  --base08: oklch(70.4% 0.191 22.216);  /* Red - brighter */
  --base09: oklch(75% 0.183 55.934);    /* Orange */
  --base0A: oklch(80% 0.15 95);         /* Yellow */
  --base0B: oklch(75% 0.15 165);        /* Green */
  --base0C: oklch(72% 0.18 210);        /* Cyan */
  --base0D: oklch(70% 0.20 265);        /* Blue */
  --base0E: oklch(72% 0.18 320);        /* Magenta */
  --base0F: oklch(65% 0.16 45);         /* Brown */
}
```

### Syntax Highlighting Color Mapping

```css
/* Token type color assignments */
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: var(--base03);
  font-style: italic;
}

.token.punctuation {
  color: var(--base05);
  opacity: 0.7; /* Tone down for "calm" editing */
}

.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant {
  color: var(--base09);
}

.token.selector,
.token.attr-name,
.token.string,
.token.char {
  color: var(--base0B);
}

.token.operator,
.token.entity,
.token.url {
  color: var(--base0C);
}

.token.atrule,
.token.attr-value,
.token.keyword {
  color: var(--base0E);
}

.token.function,
.token.class-name {
  color: var(--base0D);
}

.token.important,
.token.regex,
.token.variable {
  color: var(--base08);
}

.token.deprecated {
  color: var(--base0F);
  text-decoration: line-through;
}
```

### DuoTone Alternative (Calm, Focused Design)

DuoTone themes use only 2 hues with 7 shades, reducing visual noise:

```css
:root {
  /* DuoTone Dark - Purple/Green */
  --dt-base-hue: 260;      /* Purple for structure */
  --dt-accent-hue: 160;    /* Green for content */

  /* Structure (purple shades) */
  --dt-bg-0: oklch(18% 0.04 var(--dt-base-hue));
  --dt-bg-1: oklch(22% 0.04 var(--dt-base-hue));
  --dt-syntax-1: oklch(45% 0.08 var(--dt-base-hue)); /* Punctuation */
  --dt-syntax-2: oklch(60% 0.12 var(--dt-base-hue)); /* Keywords */

  /* Content (green shades) */
  --dt-content-1: oklch(65% 0.10 var(--dt-accent-hue)); /* Strings */
  --dt-content-2: oklch(75% 0.12 var(--dt-accent-hue)); /* Important */
  --dt-content-3: oklch(85% 0.08 var(--dt-accent-hue)); /* Highlights */
}

/* Apply to tokens */
.token.punctuation,
.token.bracket {
  color: var(--dt-syntax-1);
  opacity: 0.5; /* De-emphasize */
}

.token.keyword,
.token.operator {
  color: var(--dt-syntax-2);
}

.token.string,
.token.attr-value {
  color: var(--dt-content-1);
}

.token.function,
.token.class-name {
  color: var(--dt-content-2);
  font-weight: 500;
}
```

---

## 3. Modern Dark/Light Theme Approaches

### The light-dark() Function (2024 Standard)

**Browser Support:** Chrome 123+, Safari 17.5+, Firefox 120+ (as of 2024)

The `light-dark()` function automatically selects colors based on `color-scheme`:

```css
:root {
  /* Enable automatic theme detection */
  color-scheme: light dark;
}

/* Automatic theme switching */
body {
  background: light-dark(#ffffff, #1c1b22);
  color: light-dark(#15141a, #fbfbfe);
}

.editor-background {
  background: light-dark(
    oklch(100% 0 0),           /* Light mode: pure white */
    oklch(20% 0.01 250)        /* Dark mode: cool dark gray */
  );
}

.editor-selection {
  background: light-dark(
    oklch(85% 0.05 250 / 0.3), /* Light: subtle blue tint */
    oklch(40% 0.08 250 / 0.4)  /* Dark: deeper blue tint */
  );
}

.syntax-comment {
  color: light-dark(
    oklch(55% 0.02 250),       /* Light: medium gray */
    oklch(65% 0.03 250)        /* Dark: lighter gray */
  );
  font-style: italic;
}
```

### Advanced: Combining light-dark() with color-mix()

```css
:root {
  color-scheme: light dark;

  /* Base brand color */
  --brand-primary: oklch(55% 0.20 260);
}

/* Create subtle backgrounds that work in both modes */
.editor-gutter {
  background: light-dark(
    color-mix(in oklch, var(--brand-primary) 5%, white),
    color-mix(in oklch, var(--brand-primary) 8%, black)
  );
}

/* Hover states with automatic adaptation */
.button:hover {
  background: light-dark(
    color-mix(in oklch, currentColor 12%, transparent),
    color-mix(in oklch, currentColor 20%, transparent)
  );
}

/* Active line highlighting */
.editor-line-active {
  background: light-dark(
    color-mix(in oklch, Canvas, CanvasText 2.5%),
    color-mix(in oklch, Canvas, CanvasText 5%)
  );
}
```

### CSS Custom Properties Strategy

For complex themes with more than 2 modes, use custom properties:

```css
/* Theme definitions */
:root {
  color-scheme: light dark;
}

/* Light theme (default) */
:root {
  --editor-bg: oklch(100% 0 0);
  --editor-fg: oklch(20% 0.01 250);
  --editor-line-number: oklch(60% 0.02 250);
  --editor-selection-bg: oklch(90% 0.03 250 / 0.5);
  --editor-cursor: oklch(30% 0.20 260);
  --editor-gutter-bg: oklch(97% 0.005 250);
  --editor-active-line: oklch(95% 0.01 250);
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  :root {
    --editor-bg: oklch(22% 0.01 250);
    --editor-fg: oklch(90% 0.01 250);
    --editor-line-number: oklch(50% 0.02 250);
    --editor-selection-bg: oklch(40% 0.05 260 / 0.4);
    --editor-cursor: oklch(75% 0.20 260);
    --editor-gutter-bg: oklch(18% 0.015 250);
    --editor-active-line: oklch(26% 0.02 250);
  }
}

/* Manual override option */
[data-theme="light"] {
  color-scheme: light;
  /* Light theme variables */
}

[data-theme="dark"] {
  color-scheme: dark;
  /* Dark theme variables */
}

[data-theme="high-contrast"] {
  color-scheme: dark;
  /* High contrast theme variables with AAA compliance */
  --editor-bg: oklch(0% 0 0);
  --editor-fg: oklch(100% 0 0);
  /* ... */
}
```

### System Color Integration

Use system colors for native OS integration:

```css
.editor-context-menu {
  background: light-dark(Canvas, Canvas);
  color: light-dark(CanvasText, CanvasText);
  border: 1px solid light-dark(
    color-mix(in oklch, CanvasText 20%, transparent),
    color-mix(in oklch, CanvasText 30%, transparent)
  );
}

.button-primary {
  background: light-dark(ActiveText, ActiveText);
  color: light-dark(Canvas, Canvas);
}
```

---

## 4. Container Queries, color-mix(), Relative Colors for Adaptive UI

### Container Queries for Adaptive Layouts

```css
/* Editor with adaptive sidebar */
.editor-container {
  display: grid;
  grid-template-columns: auto 1fr;
  container-type: inline-size;
  container-name: editor-layout;
}

.editor-sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

/* Collapse sidebar on narrow containers */
@container editor-layout (max-width: 800px) {
  .editor-sidebar {
    width: 48px; /* Icon-only mode */
  }

  .sidebar-label {
    display: none;
  }

  .sidebar-icon {
    display: block;
    margin: 0 auto;
  }
}

/* Full sidebar on wide containers */
@container editor-layout (min-width: 801px) {
  .editor-sidebar {
    width: 240px;
  }

  .sidebar-label {
    display: inline;
  }
}

/* Responsive toolbar within sidebar */
@container sidebar (max-width: 230px) {
  .toolbar-item-label {
    display: none;
  }
}
```

### color-mix() for Dynamic Color Generation

```css
:root {
  --primary: oklch(60% 0.20 260);
}

/* Generate shades automatically */
.color-swatch-lighter {
  background: color-mix(in oklch, var(--primary), white 30%);
}

.color-swatch-darker {
  background: color-mix(in oklch, var(--primary), black 30%);
}

/* Transparency variations */
.overlay-light {
  background: color-mix(in oklch, var(--primary), transparent 70%);
}

/* Interactive states */
.button {
  background: var(--primary);
  transition: background 0.2s ease;
}

.button:hover {
  background: color-mix(in oklch, var(--primary), white 15%);
}

.button:active {
  background: color-mix(in oklch, var(--primary), black 10%);
}

/* Disabled state */
.button:disabled {
  background: color-mix(in oklch, var(--primary), transparent 70%);
  cursor: not-allowed;
}
```

### Relative Colors for Algorithmic Adjustments

```css
:root {
  --accent: #9333ea;
}

/* Extract and modify color channels */
.accent-lighter {
  /* Increase lightness by 10% */
  background: oklch(from var(--accent) calc(l + 0.10) c h);
}

.accent-darker {
  /* Decrease lightness by 10% */
  background: oklch(from var(--accent) calc(l - 0.10) c h);
}

.accent-desaturated {
  /* Reduce chroma by 50% for dark mode */
  background: oklch(from var(--accent) l calc(c * 0.5) h);
}

.accent-complementary {
  /* Rotate hue by 180 degrees */
  background: oklch(from var(--accent) l c calc(h + 180));
}

.accent-with-alpha {
  /* Add transparency */
  background: oklch(from var(--accent) l c h / 0.5);
}
```

### Real-World Editor Example: Adaptive Color System

```css
:root {
  color-scheme: light dark;

  /* Base brand color */
  --brand: oklch(55% 0.20 260);

  /* Automatically generated semantic colors */
  --surface-1: light-dark(
    oklch(100% 0 0),
    oklch(20% 0.01 250)
  );

  --surface-2: light-dark(
    oklch(from var(--surface-1) calc(l - 0.05) c h),
    oklch(from var(--surface-1) calc(l + 0.05) c h)
  );

  --surface-3: light-dark(
    oklch(from var(--surface-1) calc(l - 0.10) c h),
    oklch(from var(--surface-1) calc(l + 0.10) c h)
  );

  /* Text colors with guaranteed contrast */
  --text-primary: light-dark(
    oklch(25% 0.02 250),
    oklch(92% 0.01 250)
  );

  --text-secondary: light-dark(
    oklch(from var(--text-primary) calc(l + 0.30) c h),
    oklch(from var(--text-primary) calc(l - 0.30) c h)
  );

  /* Interactive colors */
  --interactive-default: var(--brand);
  --interactive-hover: oklch(from var(--brand) calc(l + 0.05) c h);
  --interactive-active: oklch(from var(--brand) calc(l - 0.05) c h);
  --interactive-disabled: color-mix(in oklch, var(--brand), transparent 70%);
}
```

---

## 5. Smooth Animations for Edit Operations

### Scroll-Driven Animations (2024 Standard)

**Browser Support:** Chrome 115+, Edge 115+, Firefox 134+ (behind flag), Safari (in progress)

Scroll-driven animations synchronize with scroll position without JavaScript:

```css
/* Fade in text as it scrolls into view */
.editor-line {
  animation: line-appear linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}

@keyframes line-appear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Highlight mark as user scrolls */
@supports (animation-timeline: view()) {
  mark {
    --highlighted: 0;
    background: transparent;
    animation: highlight steps(1) both;
    animation-timeline: view();
    animation-range: entry 100% cover 10%;
  }

  @keyframes highlight {
    to {
      --highlighted: 1;
      background: color-mix(in oklch, var(--accent) 30%, transparent);
    }
  }
}
```

### Text Insert/Delete Animations (CSS-Only)

```css
/* New text insertion animation */
@keyframes text-insert {
  from {
    opacity: 0;
    transform: scale(0.95);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}

.text-inserted {
  animation: text-insert 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: color-mix(in oklch, var(--success) 15%, transparent);
  animation-fill-mode: backwards;
}

/* Text deletion animation */
@keyframes text-delete {
  from {
    opacity: 1;
    transform: scale(1);
    max-height: 1.5em;
  }
  to {
    opacity: 0;
    transform: scale(0.9);
    max-height: 0;
    padding: 0;
    margin: 0;
  }
}

.text-deleted {
  animation: text-delete 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
  background: color-mix(in oklch, var(--error) 15%, transparent);
  text-decoration: line-through;
}
```

### Typewriter Effect (Pure CSS)

```css
.typewriter-text {
  overflow: hidden;
  border-right: 2px solid var(--cursor-color);
  white-space: nowrap;
  animation:
    typing 3.5s steps(40, end),
    blink-caret 0.75s step-end infinite;
}

@keyframes typing {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

@keyframes blink-caret {
  from, to {
    border-color: transparent;
  }
  50% {
    border-color: var(--cursor-color);
  }
}
```

### Selection Highlight Animation

```css
.editor-selection {
  position: relative;
  background: transparent;
}

.editor-selection::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--selection-color);
  animation: selection-appear 0.15s cubic-bezier(0.2, 0, 0.2, 1);
  z-index: -1;
}

@keyframes selection-appear {
  from {
    opacity: 0;
    transform: scaleX(0);
    transform-origin: left center;
  }
  to {
    opacity: 1;
    transform: scaleX(1);
  }
}
```

### View Transitions API (Cutting Edge)

For smooth DOM updates (available in Chrome/Edge 111+):

```css
/* Enable view transitions */
@view-transition {
  navigation: auto;
}

/* Customize transition for editor content */
::view-transition-old(editor-content),
::view-transition-new(editor-content) {
  animation-duration: 0.2s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-old(editor-content) {
  animation-name: fade-out;
}

::view-transition-new(editor-content) {
  animation-name: fade-in;
}

@keyframes fade-out {
  to {
    opacity: 0;
    filter: blur(4px);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    filter: blur(4px);
  }
}
```

### Performance-Optimized Animations

```css
/* Only animate transform and opacity (GPU-accelerated) */
.animated-element {
  will-change: transform, opacity;
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(20px); /* GPU-accelerated */
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Avoid animating layout properties */
.bad-animation {
  /* DON'T DO THIS - causes layout thrashing */
  animation: bad-slide 0.3s ease-out;
}

@keyframes bad-slide {
  from {
    margin-top: 20px; /* Triggers layout recalculation */
    height: 0;        /* Triggers layout recalculation */
  }
}

/* Use contain for animation isolation */
.animation-container {
  contain: layout style paint;
}
```

---

## Performance Considerations

### Avoiding Layout Thrashing

Layout thrashing occurs when JavaScript reads layout properties (offsetWidth, scrollHeight) and immediately writes style changes, forcing the browser to recalculate layout multiple times per frame.

**CSS-Only Solutions:**

```css
/* Use CSS containment to isolate layout calculations */
.editor-line {
  contain: layout style paint;
}

.editor-gutter {
  contain: strict;
}

/* Use content-visibility for virtualization */
.editor-content {
  content-visibility: auto;
  contain-intrinsic-size: 0 800px; /* Estimated height */
}

/* Batch layout reads with container queries */
.responsive-component {
  container-type: inline-size;
}

@container (min-width: 400px) {
  /* Container queries batch layout calculations */
  .responsive-component {
    padding: 2rem;
  }
}
```

### GPU Acceleration Best Practices

```css
/* Properties that trigger GPU acceleration */
.accelerated {
  transform: translateZ(0); /* Force GPU layer */
  will-change: transform, opacity;
  backface-visibility: hidden;
}

/* Efficient animations */
@keyframes gpu-friendly {
  from {
    opacity: 0;
    transform: translate3d(0, 20px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* Avoid will-change overuse */
.button:hover {
  /* Add will-change only when needed */
  will-change: transform;
  transition: transform 0.2s;
}

.button:not(:hover) {
  /* Remove when not animating */
  will-change: auto;
}
```

### ContentEditable Performance Issues

Research shows contentEditable performance degrades with:
- Large DOM trees (8000+ elements)
- Deep nesting
- Frequent re-highlighting after every keystroke

**Alternative Approach:**

```css
/* Use layered approach: textarea + preview */
.editor-wrapper {
  position: relative;
  display: grid;
  grid-template: 1fr / 1fr;
}

.editor-textarea,
.editor-preview {
  grid-area: 1 / 1;
  font-family: 'Fira Code', monospace;
  font-size: 14px;
  line-height: 1.5;
  padding: 1rem;
}

.editor-textarea {
  color: transparent;
  caret-color: var(--cursor-color);
  background: transparent;
  resize: none;
  z-index: 2;
}

.editor-preview {
  pointer-events: none;
  z-index: 1;
}
```

---

## Accessibility Considerations

### Color Contrast Testing

```css
:root {
  /* Ensure 4.5:1 minimum contrast */
  --bg: oklch(100% 0 0);          /* L: 100 */
  --text: oklch(25% 0.02 250);    /* L: 25 */
  /* Contrast ratio: 100/25 = 4.0... needs adjustment */

  /* Corrected for WCAG AA */
  --text-corrected: oklch(20% 0.02 250); /* L: 20 */
  /* Contrast ratio: 100/20 = 5.0 ✓ */
}

/* Test with browser DevTools color picker */
```

### Reduced Motion Support

```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Progressive enhancement */
@media (prefers-reduced-motion: no-preference) {
  .animated-element {
    animation: slide-in 0.3s ease-out;
  }
}
```

### Focus Indicators

```css
/* High-contrast focus indicators */
.editor-button:focus-visible {
  outline: 2px solid light-dark(
    oklch(40% 0.20 260),
    oklch(75% 0.20 260)
  );
  outline-offset: 2px;
}

/* Custom focus ring with glow */
.interactive:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--surface-1),
    0 0 0 4px var(--interactive-default),
    0 0 8px 4px color-mix(in oklch, var(--interactive-default) 40%, transparent);
}
```

### Font Scaling

```css
/* Respect user font-size preferences */
:root {
  font-size: 16px; /* Base, but allow browser zoom */
}

.editor-content {
  /* Use rem for scalability */
  font-size: clamp(0.875rem, 0.8rem + 0.3vw, 1rem);
  line-height: 1.6;
}

/* Container-relative sizing for true component isolation */
.editor-toolbar {
  container-type: inline-size;
}

.toolbar-icon {
  width: clamp(1rem, 4cqi, 1.5rem);
  height: clamp(1rem, 4cqi, 1.5rem);
}
```

---

## Recommended Color Palettes

### Professional Code Editor (Light Mode)

```css
:root {
  /* Background layers */
  --editor-bg-0: oklch(100% 0 0);           /* Pure white */
  --editor-bg-1: oklch(98% 0.003 250);      /* Subtle cool tint */
  --editor-bg-2: oklch(95% 0.005 250);      /* Gutter */
  --editor-bg-3: oklch(92% 0.008 250);      /* Active line */

  /* Foreground layers */
  --editor-fg-0: oklch(20% 0.01 250);       /* Primary text */
  --editor-fg-1: oklch(45% 0.02 250);       /* Secondary text */
  --editor-fg-2: oklch(60% 0.02 250);       /* Line numbers */
  --editor-fg-3: oklch(70% 0.015 250);      /* Comments */

  /* Syntax highlighting (WCAG AA compliant) */
  --syntax-keyword: oklch(45% 0.18 310);    /* Magenta - keywords */
  --syntax-function: oklch(48% 0.20 265);   /* Blue - functions */
  --syntax-string: oklch(50% 0.15 160);     /* Green - strings */
  --syntax-number: oklch(55% 0.20 45);      /* Orange - numbers */
  --syntax-operator: oklch(40% 0.15 260);   /* Purple - operators */
  --syntax-comment: oklch(55% 0.03 250);    /* Gray - comments */
  --syntax-error: oklch(50% 0.22 25);       /* Red - errors */

  /* UI accents */
  --accent-primary: oklch(55% 0.20 260);    /* Primary actions */
  --accent-success: oklch(60% 0.17 162);    /* Success states */
  --accent-warning: oklch(70% 0.19 70);     /* Warnings */
  --accent-error: oklch(55% 0.24 25);       /* Errors */
}
```

### Professional Code Editor (Dark Mode)

```css
[data-theme="dark"] {
  /* Background layers - Material Design #121212 base */
  --editor-bg-0: oklch(18% 0.01 250);       /* Dark base */
  --editor-bg-1: oklch(22% 0.012 250);      /* Elevated */
  --editor-bg-2: oklch(16% 0.015 250);      /* Gutter */
  --editor-bg-3: oklch(25% 0.015 250);      /* Active line */

  /* Foreground layers */
  --editor-fg-0: oklch(92% 0.005 250);      /* Primary text */
  --editor-fg-1: oklch(75% 0.01 250);       /* Secondary text */
  --editor-fg-2: oklch(55% 0.015 250);      /* Line numbers */
  --editor-fg-3: oklch(50% 0.02 250);       /* Comments */

  /* Syntax highlighting (adjusted for dark bg) */
  --syntax-keyword: oklch(72% 0.18 315);    /* Lighter magenta */
  --syntax-function: oklch(70% 0.20 265);   /* Brighter blue */
  --syntax-string: oklch(70% 0.15 165);     /* Lighter green */
  --syntax-number: oklch(75% 0.18 55);      /* Brighter orange */
  --syntax-operator: oklch(68% 0.16 270);   /* Lighter purple */
  --syntax-comment: oklch(50% 0.03 250);    /* Dimmed gray */
  --syntax-error: oklch(70% 0.22 25);       /* Brighter red */

  /* UI accents */
  --accent-primary: oklch(70% 0.20 265);
  --accent-success: oklch(70% 0.17 165);
  --accent-warning: oklch(80% 0.18 80);
  --accent-error: oklch(70% 0.24 27);
}
```

### High Contrast Theme (WCAG AAA)

```css
[data-theme="high-contrast"] {
  color-scheme: dark;

  /* Maximum contrast backgrounds */
  --editor-bg-0: oklch(0% 0 0);             /* Pure black */
  --editor-bg-1: oklch(10% 0 0);            /* Near black */
  --editor-bg-2: oklch(5% 0 0);             /* Gutter */
  --editor-bg-3: oklch(15% 0 0);            /* Active line */

  /* Maximum contrast foregrounds */
  --editor-fg-0: oklch(100% 0 0);           /* Pure white */
  --editor-fg-1: oklch(85% 0 0);            /* Light gray */
  --editor-fg-2: oklch(70% 0 0);            /* Medium gray */
  --editor-fg-3: oklch(60% 0 0);            /* Dim gray */

  /* High contrast syntax (7:1+ contrast) */
  --syntax-keyword: oklch(80% 0.25 315);    /* Bright magenta */
  --syntax-function: oklch(75% 0.25 265);   /* Bright blue */
  --syntax-string: oklch(75% 0.20 165);     /* Bright green */
  --syntax-number: oklch(85% 0.20 60);      /* Bright orange */
  --syntax-operator: oklch(78% 0.22 270);   /* Bright purple */
  --syntax-comment: oklch(65% 0.05 250);    /* Visible gray */
  --syntax-error: oklch(80% 0.28 27);       /* Bright red */

  /* High contrast accents */
  --accent-primary: oklch(80% 0.25 265);
  --accent-success: oklch(80% 0.22 165);
  --accent-warning: oklch(90% 0.20 85);
  --accent-error: oklch(85% 0.28 27);
}
```

---

## Complete Editor CSS Example

```css
/* Modern Code Editor - Complete Example */
:root {
  color-scheme: light dark;

  /* OKLCH Color System */
  --editor-bg: light-dark(oklch(100% 0 0), oklch(20% 0.01 250));
  --editor-fg: light-dark(oklch(20% 0.01 250), oklch(90% 0.01 250));
  --gutter-bg: light-dark(oklch(97% 0.005 250), oklch(16% 0.015 250));
  --line-number: light-dark(oklch(60% 0.02 250), oklch(50% 0.02 250));
  --active-line: light-dark(oklch(95% 0.01 250), oklch(25% 0.015 250));
  --selection: light-dark(
    oklch(85% 0.05 260 / 0.4),
    oklch(40% 0.08 260 / 0.5)
  );
  --cursor: oklch(55% 0.20 260);

  /* Syntax colors */
  --syn-keyword: light-dark(oklch(45% 0.18 310), oklch(72% 0.18 315));
  --syn-function: light-dark(oklch(48% 0.20 265), oklch(70% 0.20 265));
  --syn-string: light-dark(oklch(50% 0.15 160), oklch(70% 0.15 165));
  --syn-number: light-dark(oklch(55% 0.20 45), oklch(75% 0.18 55));
  --syn-comment: light-dark(oklch(55% 0.03 250), oklch(50% 0.03 250));
}

/* Editor container with containment */
.code-editor {
  display: grid;
  grid-template-columns: auto 1fr;
  background: var(--editor-bg);
  color: var(--editor-fg);
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  container-type: inline-size;
  container-name: editor;
  contain: layout style paint;
}

/* Line number gutter */
.editor-gutter {
  background: var(--gutter-bg);
  padding: 1rem 0.5rem;
  text-align: right;
  user-select: none;
  border-right: 1px solid light-dark(
    oklch(90% 0.01 250),
    oklch(30% 0.02 250)
  );
  contain: strict;
}

.line-number {
  color: var(--line-number);
  font-variant-numeric: tabular-nums;
  transition: color 0.2s ease;
}

.line-number:hover {
  color: var(--editor-fg);
}

/* Content area */
.editor-content {
  padding: 1rem;
  overflow: auto;
  content-visibility: auto;
  contain-intrinsic-size: 0 500px;
}

/* Editor lines */
.editor-line {
  position: relative;
  white-space: pre;
  contain: layout style;
}

.editor-line.active {
  background: var(--active-line);
  border-left: 2px solid var(--cursor);
  padding-left: calc(1rem - 2px);
  margin-left: -1rem;
}

/* Selection */
.editor-line::selection,
.token::selection {
  background: var(--selection);
}

/* Cursor */
.cursor {
  position: absolute;
  width: 2px;
  height: 1.4em;
  background: var(--cursor);
  animation: cursor-blink 1s step-end infinite;
}

@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}

/* Syntax highlighting tokens */
.token.keyword,
.token.control,
.token.important {
  color: var(--syn-keyword);
  font-weight: 500;
}

.token.function,
.token.class-name {
  color: var(--syn-function);
}

.token.string,
.token.attr-value {
  color: var(--syn-string);
}

.token.number,
.token.boolean {
  color: var(--syn-number);
}

.token.comment {
  color: var(--syn-comment);
  font-style: italic;
  opacity: 0.8;
}

/* Container query responsive layout */
@container editor (max-width: 600px) {
  .code-editor {
    grid-template-columns: 3rem 1fr;
  }

  .editor-gutter {
    padding: 1rem 0.25rem;
    font-size: 12px;
  }
}

/* Performance optimizations */
@supports (animation-timeline: view()) {
  .editor-line {
    animation: fade-in linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 20%;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .cursor {
    animation: none;
  }

  .editor-line {
    animation: none;
  }
}

/* Focus management */
.code-editor:focus-within .line-number {
  color: color-mix(in oklch, var(--line-number), var(--editor-fg) 30%);
}
```

---

## Sources

### Official Documentation
- **MDN Web Docs**: CSS Container Queries (November 2025)
- **MDN Web Docs**: light-dark() Function (2024)
- **MDN Web Docs**: oklch() Color Function (2025)
- **MDN Web Docs**: CSS Scroll-driven Animations (2024)
- **W3C CSS Working Group**: View Transitions Specification (October 2024)

### Industry Resources
- **Chrome for Developers**: View Transitions Update (I/O 2024, 2025 Update)
- **web.dev**: Avoid Layout Thrashing (2024)
- **web.dev**: CSS color-scheme-dependent colors with light-dark() (2024)

### Research & Best Practices
- **Measured.co**: Accessible Base16 Color Schemes (April 2024)
- **WebAIM**: Million Analysis 2024 (83.6% contrast failure rate)
- **Evil Martians**: OKLCH in CSS - Why We Quit RGB and HSL
- **Smashing Magazine**: Introduction to CSS Scroll-Driven Animations (December 2024)
- **Josh W. Comeau**: Container Queries Unleashed

### Real-World Code Examples
- **Mozilla PDF.js**: light-dark() implementation (2024)
- **Filament PHP**: Container query editor UI
- **Zulip**: OKLCH color system
- **shadcn/ui v4**: Tailwind + OKLCH theming
- **Tailwind CSS v4**: OKLCH color palette

### Accessibility Standards
- **WCAG 2.1/2.2**: Color Contrast Requirements (AA: 4.5:1, AAA: 7:1)
- **European Accessibility Act**: Enforcement (June 28, 2025)
- **AllAccessible**: Color Contrast WCAG 2025 Guide

---

## Key Takeaways

1. **Use OKLCH for all color definitions** - Perceptually uniform, wider gamut, predictable lightness
2. **Adopt light-dark() for simple themes** - Native CSS solution, no JavaScript required
3. **Container queries enable true component modularity** - 93% browser support, progressive enhancement ready
4. **Maintain WCAG AA minimum** - 4.5:1 contrast for normal text, test with DevTools
5. **Animate only transform and opacity** - GPU-accelerated, no layout thrashing
6. **Use CSS containment** - Isolate layout calculations, improve performance
7. **Respect user preferences** - prefers-color-scheme, prefers-reduced-motion
8. **Progressive enhancement** - @supports queries for new features, graceful fallbacks

The modern CSS landscape (2024-2025) provides powerful tools for creating beautiful, accessible, and performant editor interfaces entirely with CSS, minimizing JavaScript dependencies and maximizing browser-native optimizations.
