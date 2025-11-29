/**
 * Canvas Panel Component
 *
 * Main canvas container with header, toolbar, and editor
 * Integrates with Agent-Girl's existing patterns
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore, selectActiveCanvas } from './canvasStore';
import { cn } from '../lib/utils'; // Agent-Girl's utility

// Icons (using Lucide - already in Agent-Girl)
import {
  FileCode,
  FileText,
  FileType,
  ChevronDown,
  Undo2,
  Redo2,
  Copy,
  Download,
  X,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  Code,
  Lock,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface CanvasPanelProps {
  className?: string;
}

type ViewMode = 'code' | 'preview';

// ============================================================
// Canvas Panel Component
// ============================================================

export function CanvasPanel({ className }: CanvasPanelProps) {
  const {
    isCanvasOpen,
    activeCanvasId,
    panelWidth,
    setPanelWidth,
    toggleCanvas,
    undo,
    redo,
    deleteCanvas,
    updateCanvas,
  } = useCanvasStore();

  const activeCanvas = useCanvasStore(selectActiveCanvas);

  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [isResizing, setIsResizing] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  // ========================================
  // Resize Handler
  // ========================================

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = panelWidth;
    const containerWidth = window.innerWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidthPx = (startWidth / 100) * containerWidth + delta;
      const newWidthPercent = (newWidthPx / containerWidth) * 100;
      setPanelWidth(Math.max(20, Math.min(80, newWidthPercent)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth, setPanelWidth]);

  // ========================================
  // Keyboard Shortcuts
  // ========================================

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!activeCanvasId) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + Z = Undo
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo(activeCanvasId);
      }

      // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y = Redo
      if (isMod && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        redo(activeCanvasId);
      }

      // Cmd/Ctrl + \ = Toggle canvas
      if (isMod && e.key === '\\') {
        e.preventDefault();
        toggleCanvas();
      }

      // Escape = Close selector if open
      if (e.key === 'Escape' && showSelector) {
        setShowSelector(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeCanvasId, undo, redo, toggleCanvas, showSelector]);

  // ========================================
  // Actions
  // ========================================

  const handleCopy = useCallback(() => {
    if (!activeCanvas) return;
    const content = activeCanvas.contents[activeCanvas.currentIndex].content;
    navigator.clipboard.writeText(content);
    // TODO: Show toast notification
  }, [activeCanvas]);

  const handleDownload = useCallback(() => {
    if (!activeCanvas) return;
    const content = activeCanvas.contents[activeCanvas.currentIndex].content;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeCanvas.title;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeCanvas]);

  const handleClose = useCallback(() => {
    toggleCanvas(false);
  }, [toggleCanvas]);

  // ========================================
  // Render
  // ========================================

  if (!isCanvasOpen || !activeCanvas) {
    return null;
  }

  const currentContent = activeCanvas.contents[activeCanvas.currentIndex];
  const canUndo = activeCanvas.currentIndex > 0;
  const canRedo = activeCanvas.currentIndex < activeCanvas.contents.length - 1;
  const showPreview = activeCanvas.type === 'markdown' || activeCanvas.type === 'html';

  return (
    <div
      ref={panelRef}
      className={cn(
        'canvas-panel',
        isResizing && 'canvas-panel--transitioning',
        className
      )}
      style={{ width: `${panelWidth}%` }}
    >
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        className="canvas-resize-handle"
        onMouseDown={handleResizeStart}
      />

      {/* Header */}
      <header className="canvas-header">
        <div
          className="canvas-selector-trigger"
          onClick={() => setShowSelector(!showSelector)}
        >
          <CanvasIcon type={activeCanvas.type} />
          <span className="canvas-title-text">{activeCanvas.title}</span>
          <ChevronDown size={14} />
        </div>

        {activeCanvas.isLocked && (
          <div className="canvas-lock-indicator">
            <Lock size={12} />
            <span>{activeCanvas.lockedBy === 'ai' ? 'AI editing...' : 'Editing...'}</span>
          </div>
        )}

        <button
          className="canvas-toolbar-button"
          onClick={handleClose}
          title="Close canvas"
        >
          <X size={16} />
        </button>

        {/* Canvas Selector Dropdown */}
        {showSelector && (
          <CanvasSelector onClose={() => setShowSelector(false)} />
        )}
      </header>

      {/* Toolbar */}
      <div className="canvas-toolbar">
        {/* View Mode Tabs */}
        {showPreview && (
          <div className="canvas-tab-group">
            <button
              className={cn('canvas-tab', viewMode === 'code' && 'canvas-tab--active')}
              onClick={() => setViewMode('code')}
            >
              <Code size={14} />
              Code
            </button>
            <button
              className={cn('canvas-tab', viewMode === 'preview' && 'canvas-tab--active')}
              onClick={() => setViewMode('preview')}
            >
              <Eye size={14} />
              Preview
            </button>
          </div>
        )}

        {/* Version Control */}
        <div className="canvas-version-control">
          <div className="canvas-version-nav">
            <button
              className="canvas-toolbar-button"
              onClick={() => undo(activeCanvas.id)}
              disabled={!canUndo}
              title="Undo (Cmd+Z)"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="canvas-version-indicator">
              <span className="canvas-version-current">
                v{currentContent.version}
              </span>
              /{activeCanvas.contents.length}
            </span>
            <button
              className="canvas-toolbar-button"
              onClick={() => redo(activeCanvas.id)}
              disabled={!canRedo}
              title="Redo (Cmd+Shift+Z)"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="canvas-toolbar-group">
          <button
            className="canvas-toolbar-button"
            onClick={() => undo(activeCanvas.id)}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="canvas-toolbar-button"
            onClick={() => redo(activeCanvas.id)}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
          <button
            className="canvas-toolbar-button"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            <Copy size={16} />
          </button>
          <button
            className="canvas-toolbar-button"
            onClick={handleDownload}
            title="Download"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="canvas-editor-container">
        {viewMode === 'code' ? (
          <CanvasEditor
            content={currentContent.content}
            language={currentContent.language}
            onChange={(newContent) => updateCanvas(activeCanvas.id, newContent)}
            readOnly={activeCanvas.isLocked}
          />
        ) : (
          <CanvasPreview
            content={currentContent.content}
            type={activeCanvas.type}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Canvas Icon Component
// ============================================================

function CanvasIcon({ type }: { type: string }) {
  const iconProps = { size: 16, className: 'canvas-title-icon' };

  switch (type) {
    case 'code':
      return <FileCode {...iconProps} />;
    case 'markdown':
      return <FileText {...iconProps} />;
    default:
      return <FileType {...iconProps} />;
  }
}

// ============================================================
// Canvas Selector Dropdown
// ============================================================

interface CanvasSelectorProps {
  onClose: () => void;
}

function CanvasSelector({ onClose }: CanvasSelectorProps) {
  const { canvases, activeCanvasId, setActiveCanvas, createCanvas } = useCanvasStore();
  const canvasList = Array.from(canvases.values());

  const handleSelect = (id: string) => {
    setActiveCanvas(id);
    onClose();
  };

  const handleNewCanvas = () => {
    createCanvas('code', 'untitled.ts', '// New file\n');
    onClose();
  };

  return (
    <div className="canvas-selector-dropdown">
      {canvasList.map((canvas) => (
        <div
          key={canvas.id}
          className={cn(
            'canvas-selector-item',
            canvas.id === activeCanvasId && 'canvas-selector-item--active'
          )}
          onClick={() => handleSelect(canvas.id)}
        >
          <CanvasIcon type={canvas.type} />
          <span className="canvas-selector-item-title">{canvas.title}</span>
          {canvas.id === activeCanvasId && (
            <span className="canvas-selector-item-check">✓</span>
          )}
        </div>
      ))}

      <div className="canvas-selector-divider" />

      <div
        className="canvas-selector-item canvas-selector-action"
        onClick={handleNewCanvas}
      >
        <span>+ New Canvas</span>
      </div>
    </div>
  );
}

// ============================================================
// Canvas Editor Component (Simplified)
// ============================================================

interface CanvasEditorProps {
  content: string;
  language: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

function CanvasEditor({ content, language, onChange, readOnly }: CanvasEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // For a production implementation, replace this with:
  // - CodeMirror 6 (minimalSetup) for full editing
  // - OR prism-code-editor for lighter weight
  // This is a basic textarea fallback

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!readOnly) {
      onChange(e.target.value);
    }
  };

  // Handle Tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea || readOnly) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newValue =
        content.substring(0, start) + '  ' + content.substring(end);

      onChange(newValue);

      // Restore cursor position
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="canvas-editor">
      <textarea
        ref={textareaRef}
        className="canvas-editor-content"
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        data-language={language}
      />
    </div>
  );
}

// ============================================================
// Canvas Preview Component (for Markdown/HTML)
// ============================================================

interface CanvasPreviewProps {
  content: string;
  type: string;
}

function CanvasPreview({ content, type }: CanvasPreviewProps) {
  // For production, use:
  // - react-markdown (already in Agent-Girl) for Markdown
  // - Sandboxed iframe for HTML

  if (type === 'html') {
    return (
      <div className="canvas-preview">
        <iframe
          srcDoc={content}
          sandbox="allow-scripts"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="HTML Preview"
        />
      </div>
    );
  }

  // Markdown preview - basic rendering
  // In production, use react-markdown
  return (
    <div className="canvas-preview">
      <div dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(content) }} />
    </div>
  );
}

// Simple markdown to HTML (replace with react-markdown in production)
function simpleMarkdownToHtml(markdown: string): string {
  return markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />');
}

// ============================================================
// Export
// ============================================================

export default CanvasPanel;
