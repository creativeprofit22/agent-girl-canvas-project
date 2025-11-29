/**
 * Canvas Store - Zustand State Management
 *
 * Lean implementation (~2KB gzipped)
 * Compatible with Agent-Girl's existing Zustand setup
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid'; // Already used in Agent-Girl or use crypto.randomUUID()

// ============================================================
// Types
// ============================================================

export type CanvasType = 'code' | 'markdown' | 'text' | 'diagram' | 'html';

export interface CanvasContent {
  id: string;
  version: number;
  content: string;
  language: string;
  timestamp: number;
  cursorPosition?: { line: number; char: number };
}

export interface Canvas {
  id: string;
  title: string;
  type: CanvasType;
  currentIndex: number;
  contents: CanvasContent[];
  createdAt: number;
  updatedAt: number;
  isLocked: boolean;
  lockedBy?: 'user' | 'ai';
}

export interface EditCommand {
  type: 'search_replace' | 'insert' | 'delete' | 'append';
  search?: string;
  replace?: string;
  position?: number;
  content?: string;
}

export interface EditResult {
  success: boolean;
  error?: string;
  suggestion?: string;
}

// ============================================================
// Constants
// ============================================================

const MAX_CANVASES = 10;
const MAX_VERSIONS = 50;
const DEBOUNCE_MS = 1000;
const ARCHIVE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

// ============================================================
// Store Interface
// ============================================================

interface CanvasState {
  // State
  canvases: Map<string, Canvas>;
  activeCanvasId: string | null;
  isCanvasOpen: boolean;
  panelWidth: number;

  // Actions
  createCanvas: (type: CanvasType, title: string, initialContent?: string, language?: string) => string | null;
  updateCanvas: (id: string, content: string) => void;
  deleteCanvas: (id: string) => void;
  setActiveCanvas: (id: string | null) => void;
  toggleCanvas: (open?: boolean) => void;
  setPanelWidth: (width: number) => void;
  renameCanvas: (id: string, title: string) => void;

  // Version Control
  undo: (canvasId: string) => void;
  redo: (canvasId: string) => void;
  getVersion: (canvasId: string, version: number) => CanvasContent | null;
  goToVersion: (canvasId: string, index: number) => void;

  // Edit Operations
  applyEdit: (canvasId: string, edit: EditCommand) => EditResult;
  applySearchReplace: (canvasId: string, search: string, replace: string) => EditResult;

  // Locking
  acquireLock: (canvasId: string, actor: 'user' | 'ai') => boolean;
  releaseLock: (canvasId: string) => void;

  // Utilities
  getCanvas: (id: string) => Canvas | undefined;
  getCurrentContent: (canvasId: string) => string;
  exportCanvas: (canvasId: string) => { filename: string; content: string } | null;
}

// ============================================================
// Helper Functions
// ============================================================

function detectLanguage(title: string, type: CanvasType): string {
  if (type !== 'code') return type;

  const ext = title.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    css: 'css',
    scss: 'scss',
    html: 'html',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
  };

  return langMap[ext || ''] || 'plaintext';
}

function findFuzzyMatch(content: string, search: string, threshold = 0.8): string | null {
  // Simple fuzzy matching - find similar lines
  const searchLines = search.trim().split('\n');
  const contentLines = content.split('\n');

  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    const chunk = contentLines.slice(i, i + searchLines.length).join('\n');
    const similarity = calculateSimilarity(chunk, search);
    if (similarity >= threshold) {
      return chunk;
    }
  }

  return null;
}

function calculateSimilarity(a: string, b: string): number {
  // Levenshtein-based similarity (simplified)
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ============================================================
// Store Implementation
// ============================================================

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      // Initial State
      canvases: new Map(),
      activeCanvasId: null,
      isCanvasOpen: false,
      panelWidth: 50, // percentage

      // ========================================
      // Canvas CRUD
      // ========================================

      createCanvas: (type, title, initialContent = '', language) => {
        const state = get();

        if (state.canvases.size >= MAX_CANVASES) {
          // Try to archive oldest
          const archived = archiveOldest(state.canvases, state.activeCanvasId);
          if (!archived) {
            console.warn('Maximum canvases reached');
            return null;
          }
        }

        const id = nanoid(10);
        const now = Date.now();
        const detectedLanguage = language || detectLanguage(title, type);

        const canvas: Canvas = {
          id,
          title,
          type,
          currentIndex: 0,
          contents: [{
            id: nanoid(8),
            version: 1,
            content: initialContent,
            language: detectedLanguage,
            timestamp: now,
          }],
          createdAt: now,
          updatedAt: now,
          isLocked: false,
        };

        set((state) => ({
          canvases: new Map(state.canvases).set(id, canvas),
          activeCanvasId: id,
          isCanvasOpen: true,
        }));

        return id;
      },

      updateCanvas: (id, content) => {
        set((state) => {
          const canvas = state.canvases.get(id);
          if (!canvas) return state;

          const lastContent = canvas.contents[canvas.currentIndex];
          const now = Date.now();
          const timeSinceLastEdit = now - lastContent.timestamp;

          const newCanvases = new Map(state.canvases);
          const newCanvas = { ...canvas };

          if (timeSinceLastEdit < DEBOUNCE_MS) {
            // Merge rapid edits into current version
            newCanvas.contents = [...canvas.contents];
            newCanvas.contents[canvas.currentIndex] = {
              ...lastContent,
              content,
              timestamp: now,
            };
          } else {
            // Create new version
            const newVersion: CanvasContent = {
              id: nanoid(8),
              version: lastContent.version + 1,
              content,
              language: lastContent.language,
              timestamp: now,
            };

            // Truncate redo history
            newCanvas.contents = canvas.contents.slice(0, canvas.currentIndex + 1);
            newCanvas.contents.push(newVersion);
            newCanvas.currentIndex = newCanvas.contents.length - 1;

            // Limit history
            if (newCanvas.contents.length > MAX_VERSIONS) {
              newCanvas.contents.shift();
              newCanvas.currentIndex--;
            }
          }

          newCanvas.updatedAt = now;
          newCanvases.set(id, newCanvas);

          return { canvases: newCanvases };
        });
      },

      deleteCanvas: (id) => {
        set((state) => {
          const newCanvases = new Map(state.canvases);
          newCanvases.delete(id);

          let newActiveId = state.activeCanvasId;
          if (state.activeCanvasId === id) {
            // Select another canvas or null
            newActiveId = newCanvases.size > 0
              ? Array.from(newCanvases.keys())[0]
              : null;
          }

          return {
            canvases: newCanvases,
            activeCanvasId: newActiveId,
            isCanvasOpen: newActiveId !== null,
          };
        });
      },

      setActiveCanvas: (id) => {
        set({ activeCanvasId: id, isCanvasOpen: id !== null });
      },

      toggleCanvas: (open) => {
        set((state) => ({
          isCanvasOpen: open ?? !state.isCanvasOpen,
        }));
      },

      setPanelWidth: (width) => {
        set({ panelWidth: Math.max(20, Math.min(80, width)) });
      },

      renameCanvas: (id, title) => {
        set((state) => {
          const canvas = state.canvases.get(id);
          if (!canvas) return state;

          const newCanvases = new Map(state.canvases);
          newCanvases.set(id, { ...canvas, title });

          return { canvases: newCanvases };
        });
      },

      // ========================================
      // Version Control
      // ========================================

      undo: (canvasId) => {
        set((state) => {
          const canvas = state.canvases.get(canvasId);
          if (!canvas || canvas.currentIndex <= 0) return state;

          const newCanvases = new Map(state.canvases);
          newCanvases.set(canvasId, {
            ...canvas,
            currentIndex: canvas.currentIndex - 1,
            updatedAt: Date.now(),
          });

          return { canvases: newCanvases };
        });
      },

      redo: (canvasId) => {
        set((state) => {
          const canvas = state.canvases.get(canvasId);
          if (!canvas || canvas.currentIndex >= canvas.contents.length - 1) return state;

          const newCanvases = new Map(state.canvases);
          newCanvases.set(canvasId, {
            ...canvas,
            currentIndex: canvas.currentIndex + 1,
            updatedAt: Date.now(),
          });

          return { canvases: newCanvases };
        });
      },

      getVersion: (canvasId, version) => {
        const canvas = get().canvases.get(canvasId);
        if (!canvas) return null;
        return canvas.contents.find(c => c.version === version) || null;
      },

      goToVersion: (canvasId, index) => {
        set((state) => {
          const canvas = state.canvases.get(canvasId);
          if (!canvas || index < 0 || index >= canvas.contents.length) return state;

          const newCanvases = new Map(state.canvases);
          newCanvases.set(canvasId, {
            ...canvas,
            currentIndex: index,
            updatedAt: Date.now(),
          });

          return { canvases: newCanvases };
        });
      },

      // ========================================
      // Edit Operations
      // ========================================

      applyEdit: (canvasId, edit) => {
        const canvas = get().canvases.get(canvasId);
        if (!canvas) return { success: false, error: 'Canvas not found' };

        const currentContent = canvas.contents[canvas.currentIndex].content;

        switch (edit.type) {
          case 'search_replace':
            return get().applySearchReplace(canvasId, edit.search || '', edit.replace || '');

          case 'append':
            get().updateCanvas(canvasId, currentContent + (edit.content || ''));
            return { success: true };

          case 'insert':
            if (edit.position !== undefined && edit.content) {
              const newContent =
                currentContent.slice(0, edit.position) +
                edit.content +
                currentContent.slice(edit.position);
              get().updateCanvas(canvasId, newContent);
              return { success: true };
            }
            return { success: false, error: 'Position and content required for insert' };

          default:
            return { success: false, error: 'Unknown edit type' };
        }
      },

      applySearchReplace: (canvasId, search, replace) => {
        const canvas = get().canvases.get(canvasId);
        if (!canvas) return { success: false, error: 'Canvas not found' };

        const currentContent = canvas.contents[canvas.currentIndex].content;

        // Check if search exists
        if (!currentContent.includes(search)) {
          const fuzzyMatch = findFuzzyMatch(currentContent, search);

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
        const matches = currentContent.split(search).length - 1;
        if (matches > 1) {
          return {
            success: false,
            error: `Pattern found ${matches} times. Add more context to make it unique.`,
          };
        }

        // Apply the replacement
        const newContent = currentContent.replace(search, replace);
        get().updateCanvas(canvasId, newContent);

        return { success: true };
      },

      // ========================================
      // Locking
      // ========================================

      acquireLock: (canvasId, actor) => {
        const canvas = get().canvases.get(canvasId);
        if (!canvas) return false;

        if (canvas.isLocked && canvas.lockedBy !== actor) {
          return false;
        }

        set((state) => {
          const newCanvases = new Map(state.canvases);
          newCanvases.set(canvasId, {
            ...canvas,
            isLocked: true,
            lockedBy: actor,
          });
          return { canvases: newCanvases };
        });

        return true;
      },

      releaseLock: (canvasId) => {
        set((state) => {
          const canvas = state.canvases.get(canvasId);
          if (!canvas) return state;

          const newCanvases = new Map(state.canvases);
          newCanvases.set(canvasId, {
            ...canvas,
            isLocked: false,
            lockedBy: undefined,
          });

          return { canvases: newCanvases };
        });
      },

      // ========================================
      // Utilities
      // ========================================

      getCanvas: (id) => get().canvases.get(id),

      getCurrentContent: (canvasId) => {
        const canvas = get().canvases.get(canvasId);
        if (!canvas) return '';
        return canvas.contents[canvas.currentIndex]?.content || '';
      },

      exportCanvas: (canvasId) => {
        const canvas = get().canvases.get(canvasId);
        if (!canvas) return null;

        return {
          filename: canvas.title,
          content: canvas.contents[canvas.currentIndex].content,
        };
      },
    }),
    {
      name: 'agent-girl-canvas',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist essential data
        canvases: Array.from(state.canvases.entries()),
        panelWidth: state.panelWidth,
      }),
      merge: (persisted: any, current) => {
        if (persisted && persisted.canvases) {
          return {
            ...current,
            canvases: new Map(persisted.canvases),
            panelWidth: persisted.panelWidth ?? current.panelWidth,
          };
        }
        return current;
      },
    }
  )
);

// ============================================================
// Helper: Archive oldest inactive canvas
// ============================================================

function archiveOldest(canvases: Map<string, Canvas>, activeId: string | null): boolean {
  const now = Date.now();
  let oldest: [string, Canvas] | null = null;

  canvases.forEach((canvas, id) => {
    if (id === activeId) return;
    if (!oldest || canvas.updatedAt < oldest[1].updatedAt) {
      oldest = [id, canvas];
    }
  });

  if (oldest && now - oldest[1].updatedAt > ARCHIVE_AFTER_MS) {
    canvases.delete(oldest[0]);
    return true;
  }

  return false;
}

// ============================================================
// Selectors (for performance optimization)
// ============================================================

export const selectActiveCanvas = (state: CanvasState) =>
  state.activeCanvasId ? state.canvases.get(state.activeCanvasId) : undefined;

export const selectCanvasList = (state: CanvasState) =>
  Array.from(state.canvases.values());

export const selectCurrentContent = (state: CanvasState) => {
  if (!state.activeCanvasId) return '';
  const canvas = state.canvases.get(state.activeCanvasId);
  if (!canvas) return '';
  return canvas.contents[canvas.currentIndex]?.content || '';
};
