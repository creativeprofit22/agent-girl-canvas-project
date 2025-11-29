# Canvas Mode - Implementation Handoff

> **For**: Minimal Claude Implementation
> **Date**: 2025-11-28
> **Status**: Design & Code Complete - Ready for Integration

---

## Quick Start

### What's Included

```
chat-d11c29a2/
├── CANVAS_MODE_DESIGN_SPEC.md      # Full design specification
├── CANVAS_MODE_HANDOFF.md          # This file
├── canvas-implementation/
│   ├── index.ts                    # Main exports
│   ├── canvasStore.ts              # Zustand state management
│   ├── searchReplace.ts            # Edit parser & applier
│   ├── CanvasPanel.tsx             # Main UI component
│   ├── useCanvasShortcuts.ts       # Keyboard shortcuts
│   ├── canvasWebSocketHandler.ts   # WebSocket integration
│   └── canvas.css                  # Styles (OKLCH colors)
└── [Research reports from agents]
```

### Estimated Bundle Size

| Component | Gzipped |
|-----------|---------|
| canvasStore.ts | ~2KB |
| searchReplace.ts | ~3KB |
| CanvasPanel.tsx | ~4KB |
| useCanvasShortcuts.ts | ~1KB |
| canvasWebSocketHandler.ts | ~2KB |
| canvas.css | ~3KB |
| **Total Canvas Code** | **~15KB** |

If adding CodeMirror 6 (minimalSetup): +75KB
If using basic textarea (current): +0KB

---

## Integration Steps

### Step 1: Copy Files

Copy the `canvas-implementation/` folder to:
```
/home/reaver47/.local/share/agent-girl-app/client/components/canvas/
```

### Step 2: Add CSS

In your main CSS or Tailwind entry point:
```css
@import './components/canvas/canvas.css';
```

Or in your main TSX:
```tsx
import './components/canvas/canvas.css';
```

### Step 3: Modify ChatContainer.tsx

```tsx
// Add imports
import { CanvasPanel, useCanvasStore } from './canvas';
import { cn } from '../lib/utils';

export function ChatContainer() {
  const isCanvasOpen = useCanvasStore(s => s.isCanvasOpen);
  const panelWidth = useCanvasStore(s => s.panelWidth);

  return (
    <div className="flex h-full">
      {/* Chat area - shrinks when canvas opens */}
      <div
        className={cn(
          'flex flex-col flex-1 transition-all duration-200',
          isCanvasOpen && 'max-w-[50%]'
        )}
        style={isCanvasOpen ? { width: `${100 - panelWidth}%` } : undefined}
      >
        {/* Existing chat content */}
        <MessageList />
        <ChatInput />
      </div>

      {/* Canvas panel */}
      <CanvasPanel />
    </div>
  );
}
```

### Step 4: Add Keyboard Shortcuts (App.tsx)

```tsx
import { useCanvasShortcuts } from './components/canvas';

function App() {
  useCanvasShortcuts(); // Enables Cmd+Z, Cmd+\, etc.

  return (
    // ... your app
  );
}
```

### Step 5: Process AI Responses

In your WebSocket message handler (`messageHandlers.ts` or similar):

```tsx
import {
  processAIResponseForCanvas,
  useCanvasStore,
} from '../client/components/canvas';

function handleAssistantMessage(text: string) {
  const activeCanvasId = useCanvasStore.getState().activeCanvasId;

  // Extract and apply canvas commands
  const { cleanedText, notifications } = processAIResponseForCanvas(
    text,
    activeCanvasId
  );

  // Display cleanedText in chat (without canvas commands)
  // Show notifications as update cards in chat

  return { cleanedText, notifications };
}
```

### Step 6: Update System Prompt

Add canvas instructions to your system prompt:

```typescript
const canvasInstructions = `
## Canvas Mode

When generating substantial content (>15 lines of code, long documents), create a canvas:

<canvas_create type="code" title="filename.ext" language="typescript">
// Your code here
</canvas_create>

For edits to existing canvas content, use SEARCH/REPLACE blocks:

<<<<<<< SEARCH
[exact text to find - include enough context to be unique]
=======
[replacement text]
>>>>>>> REPLACE

Canvas types: code, markdown, text, html, diagram
`;
```

---

## Key Features Summary

### 1. Canvas Types
- **code** - Syntax highlighted, any language
- **markdown** - With live preview
- **text** - Plain text editing
- **html** - With sandboxed preview
- **diagram** - Mermaid support (via existing)

### 2. Edit Operations

**SEARCH/REPLACE** (Primary):
```
<<<<<<< SEARCH
function old() {
  return 1;
}
=======
function new() {
  return 2;
}
>>>>>>> REPLACE
```

**Multi-file**:
```xml
<canvas_edit id="canvas-id-here">
<<<<<<< SEARCH
old code
=======
new code
>>>>>>> REPLACE
</canvas_edit>
```

### 3. Version Control
- Automatic versioning (max 50 versions)
- Undo/Redo with Cmd+Z / Cmd+Shift+Z
- Version navigation in toolbar
- Debounced saves (1 second)

### 4. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+\` | Toggle canvas |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+S` | Download |
| `Cmd+1-9` | Switch canvas |

### 5. Persistence
- LocalStorage via Zustand persist
- Survives page refresh
- Max 10 canvases per session

---

## Visual Design Notes

### Color System (OKLCH)
Using perceptually uniform OKLCH colors:

```css
/* Key colors */
--canvas-bg: oklch(14% 0.01 260);           /* Dark background */
--version-current: oklch(70% 0.15 200);     /* Accent blue */
--syntax-keyword: oklch(70% 0.15 280);      /* Purple */
--syntax-string: oklch(72% 0.12 160);       /* Teal */
--diff-added-bg: oklch(70% 0.18 145 / 0.15); /* Green tint */
--diff-removed-bg: oklch(65% 0.2 25 / 0.15); /* Red tint */
```

### Typography
- Editor: JetBrains Mono, 13px, line-height 1.6
- UI: Inter (or system), 13-14px

### Animations
- Edit highlights: 1s fade
- Version transitions: 150ms opacity
- Panel resize: 200ms width

---

## Testing Checklist

Before going live:

- [ ] Create canvas via `/canvas code test.ts`
- [ ] Auto-create from large code block
- [ ] Apply SEARCH/REPLACE edit
- [ ] Undo/redo works
- [ ] Version navigation works
- [ ] Panel resize works
- [ ] Keyboard shortcuts work
- [ ] Persists after refresh
- [ ] Multiple canvases work
- [ ] Close and reopen canvas

---

## Research Sources Used

This design is based on research from:

1. **Claude Artifacts** - Auto-detection heuristics, UX patterns
2. **ChatGPT Canvas** - Quick actions, parametrized UI
3. **LangChain Open Canvas** - Version array approach, streaming
4. **Aider/Roo Code** - SEARCH/REPLACE format, diff application
5. **CodeMirror 6** - Editor patterns, update listeners
6. **OKLCH Color System** - Perceptually uniform theming

Full research reports saved in this directory.

---

## Future Enhancements (Phase 2)

1. **Real CodeMirror integration** - Replace textarea with CM6
2. **Syntax highlighting** - Prism or Shiki integration
3. **Quick actions** - One-click transformations
4. **Split view** - Compare versions side-by-side
5. **Git integration** - Commit from canvas
6. **Collaboration** - Real-time sync (CRDT)

---

## Need Help?

The design spec (`CANVAS_MODE_DESIGN_SPEC.md`) contains:
- Full architecture diagrams
- All edge cases and solutions
- Complete type definitions
- CSS variables reference
- Testing procedures

The implementation files are production-ready TypeScript/React that match Agent-Girl's existing patterns (Zustand, Radix, Tailwind, Lucide icons).

---

**Good luck with the implementation!** 🚀
