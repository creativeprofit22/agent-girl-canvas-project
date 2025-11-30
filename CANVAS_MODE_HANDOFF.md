# Canvas Mode Integration - Handoff Document

## Status: 64 BUGS FIXED + 5 INTEGRATION FIXES - 1 UX ISSUE REMAINING

Canvas Mode is integrated into Agent-Girl. Build passes, tests pass (214 tests, 955 assertions).

- **64 original bugs fixed** (7 critical, 18 high, 22 medium, 17 low)
- **5 integration fixes applied** (persistence, tag cleanup, system prompt, archiving, validation)
- **1 UX issue remaining**: Streaming flash (content appears in chat then moves to canvas)

---

## Bug Summary (Final)

| Severity | Original | Fixed | Remaining |
|----------|----------|-------|-----------|
| Critical | 7 | 7 | **0** |
| High | 18 | 18 | **0** |
| Medium | 22 | 22 | **0** |
| Low | 17 | 17 | **0** |
| **TOTAL** | **64** | **64** | **0** |

---

## ✅ FIXED - Critical Bugs (7/7)

| Bug | File | Fix Description |
|-----|------|-----------------|
| ~~#1~~ | canvasStore.ts:549-572 | Race condition in acquireLock - now uses `get()` before `set()` for atomic read |
| ~~#2~~ | canvasStore.ts:558-560 | Non-idempotent lock - now returns true if same actor already has lock without state change |
| ~~#3~~ | CanvasPanel.tsx:507-517 | XSS in iframe - changed `sandbox="allow-scripts"` to `sandbox="allow-same-origin"` |
| ~~#4~~ | CanvasPanel.tsx:522-526 | XSS in markdown - **FALSE POSITIVE** - code was already safe, added security comments |
| ~~#5~~ | canvasWebSocketHandler.ts:355-357 | Direct mutation - now creates new object with spread operator |
| ~~#6~~ | searchReplace.ts:78,80 | Regex lastIndex - added `fileBlockRegex.lastIndex = 0` |
| ~~#7~~ | canvasUtils.ts:24-46 | Windows reserved filenames - added CON, PRN, AUX, NUL, COM1-9, LPT1-9 blocking |

---

## ✅ FIXED - High Priority Bugs (18/18)

| Bug | File | Fix Description |
|-----|------|-----------------|
| ~~#1~~ | canvasStore.ts:256-307 | Race condition in createCanvas - moved all logic inside `set()` callback |
| ~~#2~~ | canvasStore.ts:469-500 | Memory leak - consolidated multiple `get()` calls into single state snapshot |
| ~~#3~~ | CanvasPanel.tsx:71-101 | Memory leak - added `requestAnimationFrame` throttling to resize handler |
| ~~#5~~ | CanvasPanel.tsx:288-290 | Bounds check - added `currentContent?.version ?? 0` |
| ~~#6~~ | useCanvasShortcuts.tsx:154-189 | Event listener - memoized `canvasSwitchActions` for stable references |
| ~~#7~~ | useCanvasShortcuts.tsx:166-172 | Modifier matching - reordered shortcuts, fixed shift/alt logic |
| ~~#9~~ | canvasWebSocketHandler.ts:276-297 | Regex lastIndex - added `createRegex.lastIndex = 0` |
| ~~#10~~ | canvasWebSocketHandler.ts:300-308 | Regex lastIndex - added `editRegex.lastIndex = 0` |
| ~~#11~~ | canvasStore.ts:326 | Array index bounds validation gap - added re-validation in debounce case |
| ~~#12~~ | canvasStore.ts:151 | Off-by-one in fuzzy matching loop - fixed loop condition |
| ~~#13~~ | CanvasPanel.tsx:71-101 | Race condition on panelWidth - used ref pattern to capture stable value |
| ~~#14~~ | useCanvasShortcuts.tsx:163,176 | Keyboard shortcuts breaking text input - emptied `alwaysAllowed` array |
| ~~#15~~ | searchReplace.ts:372-379 | Off-by-one in bigrams() - added single-char unigram handling |
| ~~#16~~ | searchReplace.ts:303-306 | Memory explosion in countOccurrences() - replaced split() with indexOf() loop |
| ~~#17~~ | searchReplace.ts:174 | Flawed idempotency check - removed false-positive-prone logic |
| ~~#18~~ | canvasUtils.ts:32-38 | Trailing dots not removed - added trailing dot/space removal |
| ~~#19~~ | canvasUtils.ts:24-46 | No filename length validation - added 255 char limit with extension preservation |
| ~~#20~~ | canvasUtils.ts:32-38 | Unicode BiDi chars not filtered - added BiDi override character removal |

---

## ✅ FIXED - Medium Priority Bugs (22/22)

### canvasStore.ts (4)
| Bug | Fix Description |
|-----|-----------------|
| ~~localStorage error handling~~ | Added try-catch around merge function, returns clean state on corruption |
| ~~Cursor position preservation~~ | Now saves/restores cursor position when navigating versions |
| ~~goToVersion silent failure~~ | Added descriptive console.error for invalid canvas/index |
| ~~History limit off-by-one~~ | Changed to while loop with Math.max(0, ...) protection |

### CanvasPanel.tsx (5)
| Bug | Fix Description |
|-----|-----------------|
| ~~Bounds checking~~ | Added validation before all currentIndex array access |
| ~~Stale content access~~ | Added currentItem null check after bounds validation |
| ~~Clipboard user feedback~~ | Now shows alert() on clipboard failure, not just console.log |
| ~~Blob URL timing~~ | Added 100ms setTimeout before revokeObjectURL |
| ~~Escape preventDefault~~ | Added e.preventDefault() to escape key handler |

### useCanvasShortcuts.tsx (4)
| Bug | Fix Description |
|-----|-----------------|
| ~~URL cleanup timing~~ | Increased from 1000ms to 5000ms for revokeObjectURL |
| ~~Async promise handling~~ | Added instanceof Promise check with .catch() error handling |
| ~~Input detection~~ | Added SELECT element and shadow DOM activeElement detection |
| ~~Unused dependency~~ | Removed toggleCanvas from handleSwitchCanvas dependencies |

### canvasWebSocketHandler.ts (3)
| Bug | Fix Description |
|-----|-----------------|
| ~~Parse error return~~ | Now returns errors in CanvasUpdateNotification with success: false |
| ~~Empty block validation~~ | Added .trim() === '' check for both SEARCH and REPLACE blocks |
| ~~Embedded quotes~~ | Enhanced regex to handle both quote types and escaped quotes |

### searchReplace.ts (3)
| Bug | Fix Description |
|-----|-----------------|
| ~~Range offset~~ | Changed to reverse iteration (i--) instead of array.reverse() mutation |
| ~~Dead code~~ | Removed unreachable condition, kept only the OR check |
| ~~Unicode smart quotes~~ | Added \u201C\u201D\u2018\u2019 to all quote-matching regexes |

### canvasUtils.ts (3)
| Bug | Fix Description |
|-----|-----------------|
| ~~Zero-width chars~~ | Added /[\u200B-\u200D\uFEFF]/g filter |
| ~~Dot-only filenames~~ | Added explicit check for "." and ".." |
| ~~Fallback consistency~~ | Added safeFallback = fallback \|\| 'untitled' normalization |

---

## ✅ FIXED - Low Priority Bugs (17/17)

| Bug | File | Fix Description |
|-----|------|-----------------|
| ~~LP-1~~ | useCanvasShortcuts.tsx | Deprecated navigator.platform - added userAgentData API with fallback + TypeScript types |
| ~~LP-2~~ | useCanvasShortcuts.tsx | formatShortcut no-op - changed backslash display to Unicode symbol '⧵' |
| ~~LP-3~~ | useCanvasShortcuts.tsx | handleCopy feedback - replaced console.log with alert() for user feedback |
| ~~LP-4~~ | useCanvasShortcuts.tsx | handleSave bounds - added bounds checking before array access |
| ~~LP-5~~ | searchReplace.ts | Unicode quotes - added \u2018\u2019 (single curly quotes) to all regexes |
| ~~LP-6~~ | searchReplace.ts | DiffLine docs - added clarifying comment for optional lineNumber field |
| ~~LP-7~~ | canvasStore.ts | Magic numbers - added comprehensive JSDoc for MAX_LEVENSHTEIN_LENGTH |
| ~~LP-8~~ | CanvasPanel.tsx | Keyboard accessibility - added tabIndex, onKeyDown, role="option" to selector items |
| ~~LP-9~~ | CanvasPanel.tsx | Missing aria-labels - added aria-label to all toolbar buttons |
| ~~LP-10~~ | CanvasPanel.tsx | Textarea accessibility - added aria-label to canvas editor textarea |
| ~~LP-11~~ | CanvasPanel.tsx | Missing icons - added Box/Globe icons for diagram/html canvas types |
| ~~LP-12~~ | useCanvasShortcuts.tsx | handleCopy bounds - added currentIndex bounds check before array access |
| ~~LP-13~~ | canvas.css | Browser compatibility - added hex color fallbacks for oklch() properties |
| ~~LP-14~~ | CanvasPanel.tsx | Preview error handling - added onError handler to HTML preview iframe |
| ~~LP-15~~ | canvas.css | Dropdown overflow - added max-height: 300px and overflow-y: auto |
| ~~LP-16~~ | useCanvasShortcuts.tsx | Type cleanup - created ShortcutDisplay interface, removed unnecessary cast |
| ~~LP-17~~ | CanvasPanel.tsx | Copy feedback - replaced TODO comment with console.log success message |

---

## File Locations

```
/home/reaver47/.local/share/agent-girl-app/
├── client/
│   ├── components/
│   │   ├── canvas/           # Canvas Mode (8 files)
│   │   │   ├── index.ts
│   │   │   ├── canvasStore.ts
│   │   │   ├── CanvasPanel.tsx
│   │   │   ├── useCanvasShortcuts.tsx
│   │   │   ├── canvasWebSocketHandler.ts
│   │   │   ├── searchReplace.ts
│   │   │   ├── canvasUtils.ts
│   │   │   └── canvas.css
│   │   └── chat/
│   │       └── ChatContainer.tsx  # MODIFIED
│   ├── App.tsx                    # MODIFIED
│   └── globals.css                # MODIFIED
└── server/
    └── systemPrompt.ts            # MODIFIED
```

---

## How Canvas Mode Works

### AI Creates Canvas
```
<canvas_create type="code" title="app.py" language="python">
print("Hello World")
</canvas_create>
```

### AI Edits Canvas
```
<canvas_edit id="canvas-abc123">
<<<<<<< SEARCH
print("Hello World")
=======
print("Hello, Canvas!")
>>>>>>> REPLACE
</canvas_edit>
```

### Canvas Types
- `code` - syntax highlighted code editor
- `markdown` - with preview mode
- `text` - plain text
- `html` - with iframe preview (sandboxed)
- `diagram` - for mermaid diagrams

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+\ | Toggle canvas panel |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+S | Download canvas |
| Ctrl+1-9 | Switch to canvas N |

---

---

## ✅ FIXED - Integration Issues (5/5)

| Issue | File | Fix Description |
|-------|------|-----------------|
| Canvas state not persisted | canvasStore.ts:670-694 | Added `activeCanvasId` and `isCanvasOpen` to localStorage persistence |
| Malformed tags visible in chat | ChatContainer.tsx:745 | Removed `notifications.length > 0` condition - always clean tags |
| Inconsistent canvas activation | systemPrompt.ts:187-222 | Clear ≥20 line rule with explicit DO/DON'T list |
| Silent archive failure at max capacity | canvasStore.ts:712-721 | Removed 30-minute time gate, added console warning |
| Missing attribute errors silent | canvasWebSocketHandler.ts:280-379 | Returns `{ messages, errors }`, shows Parse Error notifications |

---

## 🔴 REMAINING - Streaming Flash Issue (1)

**Problem:** When Claude generates canvas content, the raw `<canvas_create>` tags and code appear in chat during streaming, then disappear when complete and move to canvas. This creates a jarring "flash" effect.

**Root Cause:** Canvas extraction happens only when response completes (`message.type === 'result'`), not during streaming.

**File:** `ChatContainer.tsx` - streaming handler

**Solution Needed:** Stream directly to canvas
1. Detect `<canvas_create` tag during streaming
2. Route content directly to canvas panel as it streams
3. Never show canvas content in chat
4. Show placeholder like "Creating canvas..." in chat instead

**Implementation Location:**
- `ChatContainer.tsx` - where `assistant_message` streaming is handled
- Need to add state machine: `normal` → `in_canvas_tag` → `normal`
- Buffer content when in canvas tag, send to store via `updateCanvas()`

---

## Next Steps

1. ~~Fix remaining high priority bugs~~ ✅ COMPLETE
2. ~~Address 22 medium priority bugs~~ ✅ COMPLETE
3. ~~Address 17 low priority bugs~~ ✅ COMPLETE
4. ~~Fix integration issues~~ ✅ COMPLETE
5. **TODO: Implement streaming to canvas (Option B)**

### Testing Checklist

- [x] Start Agent-Girl, open a chat
- [x] Ask AI to "write a Python script with 20+ lines"
- [x] Verify canvas panel opens on right
- [x] Verify canvas content is displayed
- [ ] Verify NO flash of content in chat during streaming ← **REMAINING**
- [x] Test Ctrl+\ to toggle panel
- [x] Test Ctrl+Z undo
- [x] Ask AI to modify the code
- [x] Verify SEARCH/REPLACE edits work
- [x] Test version navigation (< > buttons)
- [x] Test download button
- [x] Test copy button
