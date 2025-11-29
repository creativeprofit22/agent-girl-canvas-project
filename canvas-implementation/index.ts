/**
 * Canvas Mode - Main Export
 *
 * All canvas-related exports in one place
 */

// Store
export {
  useCanvasStore,
  selectActiveCanvas,
  selectCanvasList,
  selectCurrentContent,
  type Canvas,
  type CanvasContent,
  type CanvasType,
  type EditCommand,
  type EditResult,
} from './canvasStore';

// Components
export { CanvasPanel, default as CanvasPanelDefault } from './CanvasPanel';

// Search/Replace
export {
  parseSearchReplaceBlocks,
  applySearchReplaceBlocks,
  generateSimpleDiff,
  parseNaturalLanguageEdit,
  type SearchReplaceBlock,
  type ParseResult,
  type ApplyResult,
  type ApplyError,
  type DiffLine,
} from './searchReplace';

// WebSocket Handler
export {
  handleCanvasMessage,
  extractCanvasCommands,
  processAIResponseForCanvas,
  type CanvasMessage,
  type CanvasCreateMessage,
  type CanvasEditMessage,
  type CanvasStreamMessage,
  type CanvasReplaceMessage,
  type CanvasLockMessage,
  type CanvasUpdateNotification,
} from './canvasWebSocketHandler';

// Hooks
export {
  useCanvasShortcuts,
  CanvasShortcutHelp,
} from './useCanvasShortcuts';

// ============================================================
// Quick Integration Guide
// ============================================================

/**
 * INTEGRATION STEPS FOR AGENT-GIRL:
 *
 * 1. Add CSS:
 *    Import './canvas-implementation/canvas.css' in your main CSS file
 *
 * 2. Add CanvasPanel to layout:
 *    ```tsx
 *    // In ChatContainer.tsx or App.tsx
 *    import { CanvasPanel, useCanvasStore } from './canvas-implementation';
 *
 *    function ChatContainer() {
 *      const isCanvasOpen = useCanvasStore(s => s.isCanvasOpen);
 *
 *      return (
 *        <div className="flex h-full">
 *          <div className={cn('flex-1', isCanvasOpen && 'max-w-[50%]')}>
 *            <ChatMessages />
 *            <ChatInput />
 *          </div>
 *          <CanvasPanel />
 *        </div>
 *      );
 *    }
 *    ```
 *
 * 3. Process AI responses for canvas commands:
 *    ```tsx
 *    // In your WebSocket message handler
 *    import { processAIResponseForCanvas, useCanvasStore } from './canvas-implementation';
 *
 *    function handleAIMessage(text: string) {
 *      const activeCanvasId = useCanvasStore.getState().activeCanvasId;
 *      const { cleanedText, notifications } = processAIResponseForCanvas(text, activeCanvasId);
 *
 *      // Display cleanedText in chat
 *      // Show notifications as update cards
 *    }
 *    ```
 *
 * 4. Add canvas context to system prompt:
 *    ```typescript
 *    const canvasSystemPrompt = `
 *    When generating substantial code (>15 lines), use canvas:
 *
 *    <canvas_create type="code" title="filename.ext">
 *    // Your code here
 *    </canvas_create>
 *
 *    For edits, use SEARCH/REPLACE:
 *    <<<<<<< SEARCH
 *    [exact text to find]
 *    =======
 *    [replacement]
 *    >>>>>>> REPLACE
 *    `;
 *    ```
 *
 * 5. Add keyboard shortcuts hook:
 *    ```tsx
 *    // In your App component
 *    import { useCanvasShortcuts } from './canvas-implementation';
 *
 *    function App() {
 *      useCanvasShortcuts(); // Enables all keyboard shortcuts
 *      // ...
 *    }
 *    ```
 */
