# Agent-Girl Canvas Mode

Research and implementation for Claude-style Canvas Mode in Agent-Girl.

## Status

**64 bugs fixed** | **5 integration fixes** | **1 UX issue remaining** (streaming flash)

See [CANVAS_MODE_HANDOFF.md](./CANVAS_MODE_HANDOFF.md) for complete status and bug tracker.

## Contents

### Design Documents
- `CANVAS_MODE_DESIGN_SPEC.md` - Full technical specification (32KB)
- `CANVAS_MODE_HANDOFF.md` - Integration guide and bug tracker

### Research Reports
| File | Description |
|------|-------------|
| `LANGCHAIN_OPEN_CANVAS_RESEARCH.md` | LangChain Open Canvas architecture analysis |
| `canvas-artifacts-research-report.md` | Claude Artifacts UX patterns |
| `document-state-management-research.md` | State management strategies |
| `lightweight-code-editor-research-2024-2025.md` | Editor library comparison |
| `modern-css-editor-ui-research.md` | CSS techniques for editor UIs |

### Implementation
Production-ready TypeScript/React code in `canvas-implementation/`:

```
canvas-implementation/
├── index.ts                    # Main exports
├── canvasStore.ts              # Zustand state management
├── searchReplace.ts            # SEARCH/REPLACE parser
├── CanvasPanel.tsx             # Main UI component
├── useCanvasShortcuts.ts       # Keyboard shortcuts
├── canvasWebSocketHandler.ts   # WebSocket integration
└── canvas.css                  # OKLCH-based styles
```

## Quick Start

**For integration:**
1. Read `CANVAS_MODE_HANDOFF.md` for current status
2. Copy `canvas-implementation/` to your project
3. Follow integration steps in handoff doc

**For research:**
- Start with `CANVAS_MODE_DESIGN_SPEC.md` for architecture overview
- Deep-dive into specific topics via research reports

## Remaining Work

1. **Streaming flash fix** - Content appears in chat during streaming then moves to canvas
   - Solution: Route content directly to canvas during streaming
   - File: `ChatContainer.tsx`

## GitHub

https://github.com/creativeprofit22/agent-girl-canvas-project
