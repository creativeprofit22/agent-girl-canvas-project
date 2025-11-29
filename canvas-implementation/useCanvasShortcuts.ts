/**
 * Canvas Keyboard Shortcuts Hook
 *
 * Centralized keyboard shortcut management for Canvas Mode
 */

import { useEffect, useCallback } from 'react';
import { useCanvasStore } from './canvasStore';

// ============================================================
// Types
// ============================================================

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

// ============================================================
// Hook
// ============================================================

export function useCanvasShortcuts() {
  const {
    activeCanvasId,
    canvases,
    isCanvasOpen,
    toggleCanvas,
    undo,
    redo,
    setActiveCanvas,
  } = useCanvasStore();

  // ========================================
  // Action Handlers
  // ========================================

  const handleUndo = useCallback(() => {
    if (activeCanvasId) {
      undo(activeCanvasId);
    }
  }, [activeCanvasId, undo]);

  const handleRedo = useCallback(() => {
    if (activeCanvasId) {
      redo(activeCanvasId);
    }
  }, [activeCanvasId, redo]);

  const handleToggleCanvas = useCallback(() => {
    toggleCanvas();
  }, [toggleCanvas]);

  const handleSave = useCallback(() => {
    if (!activeCanvasId) return;

    const canvas = canvases.get(activeCanvasId);
    if (!canvas) return;

    const content = canvas.contents[canvas.currentIndex].content;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = canvas.title;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeCanvasId, canvases]);

  const handleSwitchCanvas = useCallback((index: number) => {
    const canvasList = Array.from(canvases.keys());
    if (index < canvasList.length) {
      setActiveCanvas(canvasList[index]);
      if (!isCanvasOpen) {
        toggleCanvas(true);
      }
    }
  }, [canvases, setActiveCanvas, isCanvasOpen, toggleCanvas]);

  const handleCopy = useCallback(async () => {
    if (!activeCanvasId) return;

    const canvas = canvases.get(activeCanvasId);
    if (!canvas) return;

    const content = canvas.contents[canvas.currentIndex].content;
    await navigator.clipboard.writeText(content);

    // TODO: Show toast notification
    console.log('Copied to clipboard');
  }, [activeCanvasId, canvases]);

  // ========================================
  // Shortcut Definitions
  // ========================================

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'z',
      ctrl: true,
      action: handleUndo,
      description: 'Undo',
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      action: handleRedo,
      description: 'Redo',
    },
    {
      key: 'y',
      ctrl: true,
      action: handleRedo,
      description: 'Redo (alternative)',
    },
    {
      key: '\\',
      ctrl: true,
      action: handleToggleCanvas,
      description: 'Toggle canvas panel',
    },
    {
      key: 's',
      ctrl: true,
      action: handleSave,
      description: 'Save/Download canvas',
    },
    // Number keys 1-9 for switching canvases
    ...Array.from({ length: 9 }, (_, i) => ({
      key: String(i + 1),
      ctrl: true,
      action: () => handleSwitchCanvas(i),
      description: `Switch to canvas ${i + 1}`,
    })),
  ];

  // ========================================
  // Event Handler
  // ========================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input or textarea (except canvas editor)
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' ||
        (target.tagName === 'TEXTAREA' && !target.closest('.canvas-editor'));

      // Allow some shortcuts even in inputs
      const alwaysAllowed = ['\\', 's'];

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl
          ? (e.ctrlKey || e.metaKey)
          : (!e.ctrlKey && !e.metaKey);
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          // Block if in input unless always allowed
          if (isInInput && !alwaysAllowed.includes(shortcut.key)) {
            continue;
          }

          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  // ========================================
  // Return shortcut info for help display
  // ========================================

  return {
    shortcuts: shortcuts.map(s => ({
      keys: formatShortcut(s),
      description: s.description,
    })),
    actions: {
      undo: handleUndo,
      redo: handleRedo,
      toggleCanvas: handleToggleCanvas,
      save: handleSave,
      copy: handleCopy,
      switchCanvas: handleSwitchCanvas,
    },
  };
}

// ============================================================
// Helper Functions
// ============================================================

function formatShortcut(config: ShortcutConfig): string {
  const parts: string[] = [];
  const isMac = typeof navigator !== 'undefined' &&
    navigator.platform.toLowerCase().includes('mac');

  if (config.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (config.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (config.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Format key
  let key = config.key.toUpperCase();
  if (key === '\\') key = '\\';

  parts.push(key);

  return parts.join(isMac ? '' : '+');
}

// ============================================================
// Shortcut Help Component
// ============================================================

export function CanvasShortcutHelp() {
  const { shortcuts } = useCanvasShortcuts();

  return (
    <div className="canvas-shortcut-help">
      <h4>Keyboard Shortcuts</h4>
      <ul>
        {shortcuts.slice(0, 5).map((s, i) => (
          <li key={i}>
            <kbd>{s.keys}</kbd>
            <span>{s.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default useCanvasShortcuts;
