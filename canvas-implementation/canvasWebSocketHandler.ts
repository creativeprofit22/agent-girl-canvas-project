/**
 * Canvas WebSocket Handler
 *
 * Handles canvas-related WebSocket messages
 * For integration with Agent-Girl's existing WebSocket system
 */

import { useCanvasStore } from './canvasStore';
import { parseSearchReplaceBlocks, applySearchReplaceBlocks } from './searchReplace';

// ============================================================
// Types
// ============================================================

export interface CanvasCreateMessage {
  type: 'canvas_create';
  canvasType: 'code' | 'markdown' | 'text' | 'diagram' | 'html';
  title: string;
  content: string;
  language?: string;
}

export interface CanvasEditMessage {
  type: 'canvas_edit';
  canvasId: string;
  editBlocks: string; // Raw SEARCH/REPLACE blocks
}

export interface CanvasStreamMessage {
  type: 'canvas_stream';
  canvasId: string;
  delta: string;
  isComplete: boolean;
}

export interface CanvasReplaceMessage {
  type: 'canvas_replace';
  canvasId: string;
  content: string;
}

export interface CanvasLockMessage {
  type: 'canvas_lock';
  canvasId: string;
  locked: boolean;
  lockedBy: 'ai' | 'user';
}

export type CanvasMessage =
  | CanvasCreateMessage
  | CanvasEditMessage
  | CanvasStreamMessage
  | CanvasReplaceMessage
  | CanvasLockMessage;

export interface CanvasUpdateNotification {
  canvasId: string;
  canvasTitle: string;
  changes: string[];
  success: boolean;
  errors?: string[];
}

// ============================================================
// Message Handler
// ============================================================

export function handleCanvasMessage(
  message: CanvasMessage
): CanvasUpdateNotification | null {
  const store = useCanvasStore.getState();

  switch (message.type) {
    case 'canvas_create':
      return handleCanvasCreate(message, store);

    case 'canvas_edit':
      return handleCanvasEdit(message, store);

    case 'canvas_stream':
      return handleCanvasStream(message, store);

    case 'canvas_replace':
      return handleCanvasReplace(message, store);

    case 'canvas_lock':
      handleCanvasLock(message, store);
      return null;

    default:
      console.warn('Unknown canvas message type:', (message as any).type);
      return null;
  }
}

// ============================================================
// Individual Handlers
// ============================================================

function handleCanvasCreate(
  message: CanvasCreateMessage,
  store: ReturnType<typeof useCanvasStore.getState>
): CanvasUpdateNotification | null {
  const canvasId = store.createCanvas(
    message.canvasType,
    message.title,
    message.content,
    message.language
  );

  if (!canvasId) {
    return {
      canvasId: '',
      canvasTitle: message.title,
      changes: [],
      success: false,
      errors: ['Failed to create canvas - maximum limit reached'],
    };
  }

  return {
    canvasId,
    canvasTitle: message.title,
    changes: ['Created new canvas'],
    success: true,
  };
}

function handleCanvasEdit(
  message: CanvasEditMessage,
  store: ReturnType<typeof useCanvasStore.getState>
): CanvasUpdateNotification | null {
  const canvas = store.canvases.get(message.canvasId);
  if (!canvas) {
    return {
      canvasId: message.canvasId,
      canvasTitle: 'Unknown',
      changes: [],
      success: false,
      errors: ['Canvas not found'],
    };
  }

  // Parse the edit blocks
  const { blocks, errors: parseErrors } = parseSearchReplaceBlocks(message.editBlocks);

  if (parseErrors.length > 0) {
    console.warn('Parse errors:', parseErrors);
  }

  if (blocks.length === 0) {
    return {
      canvasId: message.canvasId,
      canvasTitle: canvas.title,
      changes: [],
      success: false,
      errors: ['No valid edit blocks found'],
    };
  }

  // Apply the edits
  const currentContent = canvas.contents[canvas.currentIndex].content;
  const result = applySearchReplaceBlocks(currentContent, blocks);

  if (result.appliedCount > 0) {
    store.updateCanvas(message.canvasId, result.newContent);
  }

  // Build change descriptions
  const changes: string[] = [];
  if (result.appliedCount > 0) {
    changes.push(`Applied ${result.appliedCount} edit(s)`);
  }

  const errors = result.errors.map(e => {
    switch (e.error) {
      case 'not_found':
        return `Could not find: "${e.search}"${e.suggestion ? ` - Did you mean: "${e.suggestion}"` : ''}`;
      case 'multiple_matches':
        return `"${e.search}" found ${e.matchCount} times - add more context`;
      case 'already_applied':
        return `Edit already applied: "${e.search}"`;
      default:
        return `Error with: "${e.search}"`;
    }
  });

  return {
    canvasId: message.canvasId,
    canvasTitle: canvas.title,
    changes,
    success: result.success,
    errors: errors.length > 0 ? errors : undefined,
  };
}

function handleCanvasStream(
  message: CanvasStreamMessage,
  store: ReturnType<typeof useCanvasStore.getState>
): CanvasUpdateNotification | null {
  const canvas = store.canvases.get(message.canvasId);
  if (!canvas) {
    console.warn('Canvas not found for streaming:', message.canvasId);
    return null;
  }

  // Append delta to current content
  const currentContent = canvas.contents[canvas.currentIndex].content;
  const newContent = currentContent + message.delta;

  // Use updateCanvas which handles debouncing
  store.updateCanvas(message.canvasId, newContent);

  // Only return notification when complete
  if (message.isComplete) {
    store.releaseLock(message.canvasId);

    return {
      canvasId: message.canvasId,
      canvasTitle: canvas.title,
      changes: ['Content generation complete'],
      success: true,
    };
  }

  return null;
}

function handleCanvasReplace(
  message: CanvasReplaceMessage,
  store: ReturnType<typeof useCanvasStore.getState>
): CanvasUpdateNotification | null {
  const canvas = store.canvases.get(message.canvasId);
  if (!canvas) {
    return {
      canvasId: message.canvasId,
      canvasTitle: 'Unknown',
      changes: [],
      success: false,
      errors: ['Canvas not found'],
    };
  }

  store.updateCanvas(message.canvasId, message.content);

  return {
    canvasId: message.canvasId,
    canvasTitle: canvas.title,
    changes: ['Content replaced'],
    success: true,
  };
}

function handleCanvasLock(
  message: CanvasLockMessage,
  store: ReturnType<typeof useCanvasStore.getState>
): void {
  if (message.locked) {
    store.acquireLock(message.canvasId, message.lockedBy);
  } else {
    store.releaseLock(message.canvasId);
  }
}

// ============================================================
// Message Parser (for AI responses)
// ============================================================

/**
 * Extract canvas commands from AI response text
 */
export function extractCanvasCommands(text: string): CanvasMessage[] {
  const messages: CanvasMessage[] = [];

  // Look for <canvas_create> tags
  const createRegex = /<canvas_create\s+type=["']([^"']+)["']\s+title=["']([^"']+)["'](?:\s+language=["']([^"']+)["'])?>([\s\S]*?)<\/canvas_create>/g;
  let match: RegExpExecArray | null;

  while ((match = createRegex.exec(text)) !== null) {
    messages.push({
      type: 'canvas_create',
      canvasType: match[1] as any,
      title: match[2],
      content: match[4].trim(),
      language: match[3],
    });
  }

  // Look for <canvas_edit> tags
  const editRegex = /<canvas_edit\s+id=["']([^"']+)["']>([\s\S]*?)<\/canvas_edit>/g;

  while ((match = editRegex.exec(text)) !== null) {
    messages.push({
      type: 'canvas_edit',
      canvasId: match[1],
      editBlocks: match[2],
    });
  }

  // Look for standalone SEARCH/REPLACE blocks (apply to active canvas)
  if (messages.length === 0) {
    const hasSearchReplace = text.includes('<<<<<<< SEARCH') &&
      text.includes('>>>>>>> REPLACE');

    if (hasSearchReplace) {
      // This would need the active canvas ID from context
      // Return as a special case
      messages.push({
        type: 'canvas_edit',
        canvasId: '__ACTIVE__', // Special marker for active canvas
        editBlocks: text,
      });
    }
  }

  return messages;
}

// ============================================================
// Integration Helper
// ============================================================

/**
 * Process AI response and apply canvas updates
 * Returns cleaned text (without canvas commands) and notifications
 */
export function processAIResponseForCanvas(
  responseText: string,
  activeCanvasId: string | null
): {
  cleanedText: string;
  notifications: CanvasUpdateNotification[];
} {
  const commands = extractCanvasCommands(responseText);
  const notifications: CanvasUpdateNotification[] = [];

  // Process each command
  for (const command of commands) {
    // Handle __ACTIVE__ placeholder
    if (command.type === 'canvas_edit' && command.canvasId === '__ACTIVE__') {
      if (activeCanvasId) {
        command.canvasId = activeCanvasId;
      } else {
        notifications.push({
          canvasId: '',
          canvasTitle: '',
          changes: [],
          success: false,
          errors: ['No active canvas for edit'],
        });
        continue;
      }
    }

    const notification = handleCanvasMessage(command);
    if (notification) {
      notifications.push(notification);
    }
  }

  // Remove canvas commands from text for display
  let cleanedText = responseText
    .replace(/<canvas_create[^>]*>[\s\S]*?<\/canvas_create>/g, '')
    .replace(/<canvas_edit[^>]*>[\s\S]*?<\/canvas_edit>/g, '')
    .trim();

  // Optionally remove SEARCH/REPLACE blocks if they were applied
  if (commands.some(c => c.type === 'canvas_edit' && c.canvasId !== '__ACTIVE__')) {
    cleanedText = cleanedText
      .replace(/<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE/g, '')
      .trim();
  }

  return { cleanedText, notifications };
}

export default handleCanvasMessage;
