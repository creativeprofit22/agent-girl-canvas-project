# Agent-Girl Canvas Mode - Design Specification

> **Version**: 1.0.0
> **Date**: 2025-11-28
> **Status**: Design Complete - Ready for Implementation
> **Target**: Minimal Claude Implementation

---

## Executive Summary

Canvas Mode is a persistent, editable workspace that lives alongside chat. It enables **token-efficient editing** through targeted edit commands instead of full content rewrites.

### Key Metrics
- **Target Bundle Addition**: < 50KB gzipped
- **Token Savings**: 80-95% for edits on large documents
- **Latency**: < 16ms for typing, < 100ms for operations

---

## 1. Canvas Concept

### 1.1 What is the Canvas?

A **dual-pane interface** where:
- **Left Pane**: Chat conversation (instructions, context, discussion)
- **Right Pane**: Canvas workspace (persistent, editable content)

```
┌─────────────────────────────────────────────────────────────┐
│  Agent-Girl                                    [◐] [≡] [×]  │
├─────────────────────┬───────────────────────────────────────┤
│                     │  Canvas: landing-page.tsx        [▼]  │
│  Chat               │  ┌─────────────────────────────────┐  │
│                     │  │ // Hero Section                 │  │
│  User: Create a     │  │ export function Hero() {        │  │
│  hero section       │  │   return (                      │  │
│                     │  │     <section className="...">   │  │
│  Agent: I'll create │  │       <h1>Welcome</h1>          │  │
│  a hero component   │  │     </section>                  │  │
│  with...            │  │   )                             │  │
│                     │  │ }                               │  │
│  [Send message]     │  └─────────────────────────────────┘  │
│                     │  [Code] [Preview] │ v3 ◀ ● ▶ │ [⟳] [↓] │
└─────────────────────┴───────────────────────────────────────┘
```

### 1.2 When Does Content Go to Canvas?

**Auto-Detection Rule (15-Line Heuristic)**:
Content goes to canvas when it is:

| Criterion | Description | Example |
|-----------|-------------|---------|
| **Significant** | > 15 lines OR > 500 characters | Code files, articles |
| **Self-contained** | Stands alone without chat context | Complete functions |
| **Editable** | User will likely modify it | Drafts, code |
| **Reusable** | Will be used outside chat | Components, scripts |

**Explicit Triggers**:
- User types `/canvas` or `/c` before request
- User selects "Send to Canvas" from message menu
- User clicks canvas icon next to code blocks

**What Stays in Chat**:
- Quick answers (< 15 lines)
- Explanations and discussions
- Error messages and debugging output
- Lists and comparisons

### 1.3 Content Types Supported

| Type | Extension | Features |
|------|-----------|----------|
| **Code** | .ts, .tsx, .js, .py, etc. | Syntax highlighting, formatting |
| **Markdown** | .md | Live preview, formatting toolbar |
| **Plain Text** | .txt | Basic editing |
| **Diagrams** | .mermaid | Visual preview |
| **HTML** | .html | Live preview |
| **JSON/YAML** | .json, .yaml | Validation, formatting |

---

## 2. Edit Command Syntax

### 2.1 Core Philosophy

**Token Efficiency**: Instead of rewriting entire files, use targeted commands.

```
BEFORE (Inefficient - 1000+ tokens):
"Here's the updated file: [entire 500-line file]"

AFTER (Efficient - 50 tokens):
"REPLACE lines 45-48 with: [4 new lines]"
```

### 2.2 Command Format

Commands use a **SEARCH/REPLACE** block format (proven by Aider, Roo Code, Melty):

```
<<<<<<< SEARCH
[exact text to find - with context]
=======
[replacement text]
>>>>>>> REPLACE
```

### 2.3 Edit Operations

#### 2.3.1 REPLACE (Most Common)
```
<<<<<<< SEARCH
function login(user, pass) {
  return api.auth(user, pass);
}
=======
function login(user, pass) {
  if (!user || !pass) throw new Error("Missing credentials");
  return api.auth(user, pass);
}
>>>>>>> REPLACE
```

#### 2.3.2 INSERT (Before/After)
```
<<<<<<< SEARCH
import React from 'react';
=======
import React from 'react';
import { useState } from 'react';
>>>>>>> REPLACE
```

#### 2.3.3 DELETE
```
<<<<<<< SEARCH
// TODO: Remove this debug code
console.log('debug:', data);
=======
>>>>>>> REPLACE
```

#### 2.3.4 APPEND (End of File)
```
<<<<<<< SEARCH
// END OF FILE
=======
// END OF FILE

export default Component;
>>>>>>> REPLACE
```

### 2.4 Natural Language Mapping

The AI can express edits in natural language, which gets parsed:

| Natural Language | Parsed Command |
|-----------------|----------------|
| "Add validation to the login function" | REPLACE with context |
| "Remove the console.log on line 42" | DELETE at line |
| "Insert a new import at the top" | INSERT after first line |
| "Append an export statement" | APPEND to end |
| "Replace 'foo' with 'bar' everywhere" | REPLACE_ALL |

### 2.5 Multi-File Operations

For operations across files:

```xml
<file path="src/components/Button.tsx">
<<<<<<< SEARCH
export function Button({ label }) {
=======
export function Button({ label, variant = 'primary' }) {
>>>>>>> REPLACE
</file>

<file path="src/types.ts">
<<<<<<< SEARCH
// END OF FILE
=======
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
>>>>>>> REPLACE
</file>
```

### 2.6 Selection-Based Editing

When user highlights text in canvas:

```typescript
interface HighlightedEdit {
  canvasId: string;
  selection: {
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  };
  instruction: string; // "make this async", "add error handling"
}
```

The AI receives **500 chars context** before and after selection for accurate edits.

---

## 3. State Management

### 3.1 Architecture Overview

Uses **Zustand** (already in Agent-Girl) with a version history array:

```typescript
// stores/canvasStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CanvasContent {
  id: string;
  version: number;
  content: string;
  language: string;
  timestamp: number;
  cursorPosition?: { line: number; char: number };
}

interface Canvas {
  id: string;
  title: string;
  type: 'code' | 'markdown' | 'text' | 'diagram';
  currentIndex: number;
  contents: CanvasContent[];  // Version history
  createdAt: number;
  updatedAt: number;
}

interface CanvasState {
  // State
  canvases: Map<string, Canvas>;
  activeCanvasId: string | null;
  isCanvasOpen: boolean;
  panelWidth: number;

  // Actions
  createCanvas: (type: Canvas['type'], initialContent?: string) => string;
  updateCanvas: (id: string, content: string) => void;
  deleteCanvas: (id: string) => void;
  setActiveCanvas: (id: string | null) => void;
  toggleCanvas: (open?: boolean) => void;
  setPanelWidth: (width: number) => void;

  // Version Control
  undo: (canvasId: string) => void;
  redo: (canvasId: string) => void;
  getVersion: (canvasId: string, version: number) => CanvasContent | null;

  // Edit Operations
  applyEdit: (canvasId: string, edit: EditCommand) => boolean;
}
```

### 3.2 Version Control

**Snapshot-based** (simpler than diffs for single-user):

```typescript
const MAX_VERSIONS = 50;
const DEBOUNCE_MS = 1000; // Merge rapid edits

function updateCanvas(id: string, content: string) {
  const canvas = canvases.get(id);
  if (!canvas) return;

  const lastContent = canvas.contents[canvas.currentIndex];
  const timeSinceLastEdit = Date.now() - lastContent.timestamp;

  if (timeSinceLastEdit < DEBOUNCE_MS) {
    // Update current version (merge rapid typing)
    canvas.contents[canvas.currentIndex] = {
      ...lastContent,
      content,
      timestamp: Date.now(),
    };
  } else {
    // Create new version
    const newVersion: CanvasContent = {
      id: nanoid(),
      version: lastContent.version + 1,
      content,
      language: lastContent.language,
      timestamp: Date.now(),
    };

    // Truncate redo history
    canvas.contents = canvas.contents.slice(0, canvas.currentIndex + 1);
    canvas.contents.push(newVersion);
    canvas.currentIndex++;

    // Limit history size
    if (canvas.contents.length > MAX_VERSIONS) {
      canvas.contents.shift();
      canvas.currentIndex--;
    }
  }
}
```

### 3.3 Persistence Strategy

**IndexedDB** for documents (via Zustand persist):

```typescript
import { persist, createJSONStorage } from 'zustand/middleware';

const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      // ... state and actions
    }),
    {
      name: 'agent-girl-canvas',
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          const db = await openDB();
          return db.get('canvas', name);
        },
        setItem: async (name, value) => {
          const db = await openDB();
          await db.put('canvas', value, name);
        },
        removeItem: async (name) => {
          const db = await openDB();
          await db.delete('canvas', name);
        },
      })),
      partialize: (state) => ({
        canvases: state.canvases,
        panelWidth: state.panelWidth,
      }),
    }
  )
);
```

### 3.4 Undo/Redo Implementation

```typescript
function undo(canvasId: string) {
  const canvas = canvases.get(canvasId);
  if (!canvas || canvas.currentIndex <= 0) return;

  canvas.currentIndex--;
  // UI automatically reflects canvas.contents[canvas.currentIndex]
}

function redo(canvasId: string) {
  const canvas = canvases.get(canvasId);
  if (!canvas || canvas.currentIndex >= canvas.contents.length - 1) return;

  canvas.currentIndex++;
}

// Keyboard shortcuts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo(activeCanvasId);
      }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo(activeCanvasId);
      }
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [activeCanvasId]);
```

---

## 4. UX Flow

### 4.1 Creating a Canvas

**Method 1: Auto-Creation**
```
User: "Write a React component for a pricing table"
Agent: [Generates > 15 lines] → Auto-creates canvas
       "I've created the pricing table component in your canvas."
```

**Method 2: Explicit Command**
```
User: "/canvas Create a new Python script"
Agent: [Creates canvas immediately, then generates content]
```

**Method 3: From Code Block**
```
User: [Clicks "Open in Canvas" on existing code block]
      → Content moves to canvas panel
```

### 4.2 Canvas Panel Controls

```
┌─────────────────────────────────────────────────────┐
│ 📄 hero-section.tsx                           [▼]  │
├─────────────────────────────────────────────────────┤
│ [Code] [Preview]  │  ◀ v2/5 ▶  │  [↶] [↷] [⋮]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  // Content here                                    │
│                                                     │
└─────────────────────────────────────────────────────┘

Legend:
[▼]     - Canvas selector dropdown
[Code]  - Raw code view
[Preview] - Rendered preview (for HTML/Markdown)
◀ v2/5 ▶ - Version navigation (current/total)
[↶] [↷] - Undo/Redo buttons
[⋮]     - More options (copy, download, close, etc.)
```

### 4.3 Switching Between Canvases

**Canvas Selector Dropdown**:
```
┌─────────────────────────────┐
│ 📄 hero-section.tsx     ✓   │
│ 📄 pricing-table.tsx        │
│ 📝 README.md                │
│ ──────────────────────────  │
│ + New Canvas                │
│ 📁 Open from file...        │
└─────────────────────────────┘
```

### 4.4 Closing Canvas

**Options**:
1. **Minimize**: Hide panel, keep canvas in session
2. **Close**: Remove canvas (with confirmation if unsaved)
3. **Save & Close**: Download file, then close

### 4.5 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + \` | Toggle canvas panel |
| `Cmd/Ctrl + Shift + N` | New canvas |
| `Cmd/Ctrl + S` | Save/Download current canvas |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + [1-9]` | Switch to canvas N |
| `Escape` | Focus chat input |

---

## 5. Chat-Canvas Integration

### 5.1 Referencing Canvas in Chat

**Implicit Reference** (Active Canvas):
```
User: "Add a hover effect to the button"
Agent: [Applies edit to active canvas]
```

**Explicit Reference**:
```
User: "In @hero-section.tsx, make the title larger"
Agent: [Edits specific canvas]
```

**Cross-Reference**:
```
User: "Use the same color scheme from @pricing.tsx in @hero.tsx"
Agent: [Reads one, edits another]
```

### 5.2 Canvas Updates in Conversation

**Edit Notification Format**:
```
┌─────────────────────────────────────────────────────┐
│ ✏️ Canvas Updated: hero-section.tsx                  │
│                                                     │
│ • Added hover effect to Button component            │
│ • Changed background color to gradient              │
│                                                     │
│ [View Changes]  [Undo]                              │
└─────────────────────────────────────────────────────┘
```

**Inline Diff Display** (Optional):
```diff
- <button className="bg-blue-500">
+ <button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:scale-105">
```

### 5.3 Streaming Updates

During AI generation, canvas updates in real-time:

```typescript
// WebSocket message handler
function handleCanvasStream(data: CanvasStreamChunk) {
  if (data.type === 'canvas_delta') {
    // Append to current canvas content
    appendToCanvas(data.canvasId, data.delta);
  } else if (data.type === 'canvas_edit') {
    // Apply search/replace edit
    applyEdit(data.canvasId, data.edit);
  } else if (data.type === 'canvas_complete') {
    // Finalize and create version snapshot
    finalizeCanvas(data.canvasId);
  }
}
```

### 5.4 Context Injection

When sending messages, include canvas context efficiently:

```typescript
function buildMessageWithCanvasContext(
  userMessage: string,
  activeCanvas: Canvas | null
): string {
  if (!activeCanvas) return userMessage;

  const currentContent = activeCanvas.contents[activeCanvas.currentIndex];

  // Only include if relevant (mentioned or active)
  const canvasContext = `
<active_canvas>
<title>${activeCanvas.title}</title>
<type>${activeCanvas.type}</type>
<content>
${currentContent.content}
</content>
</active_canvas>
`;

  return canvasContext + '\n\n' + userMessage;
}
```

---

## 6. Visual Design

### 6.1 Color System (OKLCH)

Modern CSS using OKLCH for perceptually uniform colors:

```css
:root {
  /* Canvas Panel Background */
  --canvas-bg: oklch(14% 0.01 260);
  --canvas-border: oklch(25% 0.02 260);

  /* Editor Colors */
  --editor-bg: oklch(12% 0.005 260);
  --editor-line-number: oklch(45% 0.01 260);
  --editor-cursor: oklch(75% 0.15 200);
  --editor-selection: oklch(35% 0.08 260 / 0.5);

  /* Syntax Highlighting (DuoTone-inspired) */
  --syntax-keyword: oklch(70% 0.15 280);    /* Purple */
  --syntax-string: oklch(72% 0.12 160);     /* Teal */
  --syntax-function: oklch(75% 0.14 230);   /* Blue */
  --syntax-comment: oklch(50% 0.02 260);    /* Gray */
  --syntax-variable: oklch(80% 0.05 260);   /* Light */
  --syntax-number: oklch(72% 0.15 50);      /* Orange */
  --syntax-operator: oklch(65% 0.08 260);   /* Muted */

  /* Status Colors */
  --canvas-success: oklch(70% 0.18 145);
  --canvas-warning: oklch(75% 0.18 80);
  --canvas-error: oklch(65% 0.2 25);

  /* Version Indicator */
  --version-current: oklch(70% 0.15 200);
  --version-dot: oklch(50% 0.05 260);
}

/* Light mode overrides */
[data-theme="light"] {
  --canvas-bg: oklch(98% 0.005 260);
  --canvas-border: oklch(85% 0.01 260);
  --editor-bg: oklch(100% 0 0);
  --editor-line-number: oklch(60% 0.01 260);
  /* ... etc */
}
```

### 6.2 Typography

```css
:root {
  /* Code Editor */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  --font-size-code: 13px;
  --line-height-code: 1.6;

  /* Canvas UI */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-size-ui: 13px;
  --font-size-title: 14px;
}

.canvas-editor {
  font-family: var(--font-mono);
  font-size: var(--font-size-code);
  line-height: var(--line-height-code);
  font-feature-settings: 'liga' 1, 'calt' 1;  /* Ligatures */
  font-variant-ligatures: contextual;
}
```

### 6.3 Edit Animations

Smooth feedback for edits:

```css
/* Text insertion animation */
@keyframes text-insert {
  from {
    background-color: oklch(70% 0.18 145 / 0.3);
  }
  to {
    background-color: transparent;
  }
}

.canvas-line--inserted {
  animation: text-insert 1s ease-out;
}

/* Text deletion (flash before remove) */
@keyframes text-delete {
  0% { opacity: 1; background-color: oklch(65% 0.2 25 / 0.3); }
  50% { opacity: 0.5; }
  100% { opacity: 0; height: 0; }
}

.canvas-line--deleted {
  animation: text-delete 0.3s ease-out forwards;
}

/* Version change transition */
.canvas-content {
  transition: opacity 0.15s ease;
}

.canvas-content--transitioning {
  opacity: 0.7;
}
```

### 6.4 Panel Resize

```css
.canvas-panel {
  min-width: 300px;
  max-width: 80vw;
  transition: width 0.2s ease;
}

.canvas-resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
}

.canvas-resize-handle:hover,
.canvas-resize-handle:active {
  background: var(--canvas-border);
}
```

### 6.5 Diff Highlighting

```css
/* Inline diff in chat */
.diff-line--added {
  background: oklch(70% 0.18 145 / 0.15);
  border-left: 3px solid oklch(70% 0.18 145);
}

.diff-line--removed {
  background: oklch(65% 0.2 25 / 0.15);
  border-left: 3px solid oklch(65% 0.2 25);
  text-decoration: line-through;
  opacity: 0.7;
}

.diff-line--context {
  color: var(--syntax-comment);
}
```

---

## 7. Edge Cases

### 7.1 Conflict Resolution

**Scenario**: User edits canvas manually while AI is generating.

**Solution**: Optimistic Locking
```typescript
interface EditLock {
  canvasId: string;
  lockedBy: 'user' | 'ai';
  lockedAt: number;
}

function acquireLock(canvasId: string, actor: 'user' | 'ai'): boolean {
  const existing = locks.get(canvasId);
  if (existing && existing.lockedBy !== actor) {
    // Show conflict warning
    showToast(`Canvas is being edited by ${existing.lockedBy}`);
    return false;
  }
  locks.set(canvasId, { canvasId, lockedBy: actor, lockedAt: Date.now() });
  return true;
}

// Auto-release after 30 seconds
setInterval(() => {
  locks.forEach((lock, id) => {
    if (Date.now() - lock.lockedAt > 30000) {
      locks.delete(id);
    }
  });
}, 5000);
```

**UI Indicator**:
```
┌─────────────────────────────────────────────────────┐
│ 📄 hero.tsx                    🤖 AI editing...     │
├─────────────────────────────────────────────────────┤
│ [Locked - AI is making changes]                     │
└─────────────────────────────────────────────────────┘
```

### 7.2 Large Documents (> 5000 lines)

**Strategies**:
1. **Windowed Loading**: Only render visible lines + buffer
2. **Chunked Edits**: Process edits in 500-line chunks
3. **Warning Threshold**: Show performance warning at 3000 lines

```typescript
const LARGE_DOC_THRESHOLD = 3000;
const CHUNK_SIZE = 500;

function handleLargeDocument(content: string) {
  const lines = content.split('\n').length;

  if (lines > LARGE_DOC_THRESHOLD) {
    showToast(
      `Large document (${lines} lines). Consider splitting into smaller files.`,
      'warning'
    );
  }
}

// Chunked edit application
async function applyEditsChunked(edits: EditCommand[]) {
  for (let i = 0; i < edits.length; i += CHUNK_SIZE) {
    const chunk = edits.slice(i, i + CHUNK_SIZE);
    await applyEditBatch(chunk);
    // Allow UI to update
    await new Promise(r => requestAnimationFrame(r));
  }
}
```

### 7.3 Multiple Canvases

**Limits**:
- Maximum 10 canvases per session
- Oldest inactive canvas auto-archived after 30 minutes
- Clear warning when approaching limit

```typescript
const MAX_CANVASES = 10;
const ARCHIVE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

function createCanvas(type: Canvas['type']): string | null {
  if (canvases.size >= MAX_CANVASES) {
    // Try to archive oldest inactive
    const archived = archiveOldestInactive();
    if (!archived) {
      showToast('Maximum canvases reached. Close one to create a new one.', 'error');
      return null;
    }
  }
  // ... create canvas
}

function archiveOldestInactive(): boolean {
  const now = Date.now();
  let oldest: [string, Canvas] | null = null;

  canvases.forEach((canvas, id) => {
    if (id === activeCanvasId) return; // Don't archive active
    if (!oldest || canvas.updatedAt < oldest[1].updatedAt) {
      oldest = [id, canvas];
    }
  });

  if (oldest && now - oldest[1].updatedAt > ARCHIVE_AFTER_MS) {
    // Save to IndexedDB archive, remove from active
    archiveCanvas(oldest[0]);
    return true;
  }
  return false;
}
```

### 7.4 Search/Replace Failures

When SEARCH pattern isn't found:

```typescript
interface EditResult {
  success: boolean;
  error?: string;
  suggestion?: string;
}

function applySearchReplace(
  content: string,
  search: string,
  replace: string
): EditResult {
  if (!content.includes(search)) {
    // Try fuzzy match
    const fuzzyMatch = findFuzzyMatch(content, search);

    if (fuzzyMatch) {
      return {
        success: false,
        error: 'Exact match not found',
        suggestion: `Did you mean:\n"${fuzzyMatch}"`,
      };
    }

    return {
      success: false,
      error: 'Search pattern not found in document',
    };
  }

  // Check for multiple matches
  const matches = content.split(search).length - 1;
  if (matches > 1) {
    return {
      success: false,
      error: `Pattern found ${matches} times. Add more context to make it unique.`,
    };
  }

  return {
    success: true,
  };
}
```

### 7.5 Network Interruption During Streaming

```typescript
function handleStreamInterruption(canvasId: string) {
  const canvas = canvases.get(canvasId);
  if (!canvas) return;

  // Mark as incomplete
  const current = canvas.contents[canvas.currentIndex];
  current.content += '\n\n// ⚠️ Generation interrupted - content may be incomplete';

  // Create recovery version
  updateCanvas(canvasId, current.content);

  showToast('Generation interrupted. Your progress has been saved.', 'warning');
}
```

---

## 8. Implementation Guide

### 8.1 File Structure

```
client/
├── components/
│   └── canvas/
│       ├── Canvas.tsx              # Main canvas container
│       ├── CanvasPanel.tsx         # Right panel wrapper
│       ├── CanvasEditor.tsx        # Code/text editor
│       ├── CanvasPreview.tsx       # Rendered preview
│       ├── CanvasToolbar.tsx       # Top toolbar
│       ├── CanvasSelector.tsx      # Canvas dropdown
│       ├── VersionControl.tsx      # Undo/redo/version nav
│       ├── DiffView.tsx            # Inline diff display
│       └── ResizeHandle.tsx        # Panel resize
├── stores/
│   └── canvasStore.ts              # Zustand store
├── hooks/
│   └── useCanvasShortcuts.ts       # Keyboard shortcuts
├── utils/
│   ├── canvasEditParser.ts         # Parse edit commands
│   ├── searchReplace.ts            # Apply edits
│   └── canvasSyntax.ts             # Syntax highlighting
└── styles/
    └── canvas.css                  # Canvas-specific styles
```

### 8.2 Dependencies to Add

```json
{
  "dependencies": {
    // Lightweight code editing (choose one)
    "prism-code-editor": "^3.0.0",    // ~8KB gzipped
    // OR
    "@codemirror/view": "^6.0.0",     // ~75KB for minimal setup

    // Diff computation
    "diff": "^5.0.0",                 // ~6KB gzipped

    // Already have:
    // - zustand (state)
    // - react-syntax-highlighter (fallback)
    // - framer-motion (animations)
  }
}
```

### 8.3 Integration Points

**1. ChatContainer.tsx**
```typescript
// Add canvas state
const { isCanvasOpen, activeCanvasId } = useCanvasStore();

// Modify layout
return (
  <div className="flex h-full">
    <div className={cn('flex-1', isCanvasOpen && 'max-w-[40%]')}>
      <ChatMessages />
      <ChatInput />
    </div>
    {isCanvasOpen && (
      <CanvasPanel canvasId={activeCanvasId} />
    )}
  </div>
);
```

**2. WebSocket Message Handler**
```typescript
// server/websocket/messageHandlers.ts
case 'canvas_create':
  // Handle canvas creation from AI
  break;
case 'canvas_edit':
  // Handle search/replace edit
  break;
case 'canvas_stream':
  // Handle streaming content
  break;
```

**3. System Prompt Addition**
```typescript
// Add to system prompt when canvas is active
const canvasInstructions = `
When editing canvas content, use SEARCH/REPLACE blocks:

<<<<<<< SEARCH
[exact text to find]
=======
[replacement text]
>>>>>>> REPLACE

For new content, create a new canvas with:
<canvas_create type="code" title="filename.ext">
content here
</canvas_create>
`;
```

### 8.4 Bundle Size Budget

| Component | Estimated Size (gzipped) |
|-----------|-------------------------|
| CanvasStore (Zustand) | ~2KB |
| Canvas Components | ~8KB |
| prism-code-editor | ~8KB |
| diff library | ~6KB |
| CSS | ~3KB |
| **Total** | **~27KB** |

If using CodeMirror 6 minimal: +48KB = **~75KB total**

---

## 9. Testing Checklist

### 9.1 Functional Tests

- [ ] Create canvas from chat command
- [ ] Auto-create canvas for large code blocks
- [ ] Apply SEARCH/REPLACE edits
- [ ] Handle multiple edit operations
- [ ] Undo/redo functionality
- [ ] Version navigation
- [ ] Switch between canvases
- [ ] Close and reopen canvases
- [ ] Persist across page refresh
- [ ] Keyboard shortcuts work
- [ ] Panel resize works

### 9.2 Edge Case Tests

- [ ] Edit conflict handling
- [ ] Large document (5000+ lines)
- [ ] Maximum canvases limit
- [ ] SEARCH pattern not found
- [ ] Network interruption
- [ ] Rapid successive edits
- [ ] Special characters in content
- [ ] Unicode content
- [ ] Empty canvas
- [ ] Read-only mode

### 9.3 Performance Tests

- [ ] Typing latency < 16ms
- [ ] Edit application < 50ms
- [ ] Version switch < 100ms
- [ ] 1000-line document renders smoothly
- [ ] Memory usage stable over time

---

## 10. Future Enhancements (Phase 2+)

1. **Collaborative Editing** - Real-time sync between sessions
2. **Git Integration** - Commit canvas content directly
3. **Custom Quick Actions** - User-defined transformation buttons
4. **Split View** - Compare two versions side-by-side
5. **Folder Organization** - Group related canvases
6. **Templates** - Quick-start canvas templates
7. **Export Options** - Copy as image, export to Gist
8. **AI Suggestions** - Inline completions in canvas

---

## Appendix A: Research Sources

### Primary Research
1. Claude Artifacts UX - Anthropic official documentation
2. ChatGPT Canvas - OpenAI implementation analysis
3. LangChain Open Canvas - https://github.com/langchain-ai/open-canvas
4. Aider Edit Formats - https://aider.chat/docs/unified-diffs.html
5. Roo Code ApplyDiff - https://github.com/RooCodeInc/Roo-Code

### Technical References
1. CodeMirror 6 Bundle Analysis - https://codemirror.net/examples/bundle/
2. Prism Code Editor - https://github.com/FIameCaster/prism-code-editor
3. IndexedDB Performance - https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html
4. OKLCH Color System - https://oklch.com/

### Design References
1. Cursor Editor UX patterns
2. VSCode Extension API for editors
3. GitHub Copilot edit mode

---

## Appendix B: Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    CANVAS MODE QUICK REFERENCE               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CREATE:    /canvas [type] [name]                           │
│             /c code myfile.ts                               │
│                                                             │
│  REFERENCE: @canvas-name in chat                            │
│             "In @pricing.tsx, add..."                       │
│                                                             │
│  SHORTCUTS:                                                 │
│    Cmd+\        Toggle canvas panel                         │
│    Cmd+Z        Undo                                        │
│    Cmd+Shift+Z  Redo                                        │
│    Cmd+S        Save/Download                               │
│    Cmd+1-9      Switch canvas                               │
│    Escape       Focus chat                                  │
│                                                             │
│  EDIT FORMAT:                                               │
│    <<<<<<< SEARCH                                           │
│    [text to find]                                           │
│    =======                                                  │
│    [replacement]                                            │
│    >>>>>>> REPLACE                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**Document Status**: Complete
**Ready for**: Minimal Claude Implementation
**Estimated Implementation Time**: 2-3 days for MVP
