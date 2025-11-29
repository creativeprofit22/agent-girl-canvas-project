/**
 * Search/Replace Edit Parser and Applier
 *
 * Parses SEARCH/REPLACE blocks from AI responses
 * and applies them to canvas content efficiently.
 *
 * ~3KB gzipped
 */

// ============================================================
// Types
// ============================================================

export interface SearchReplaceBlock {
  search: string;
  replace: string;
  filePath?: string;
}

export interface ParseResult {
  blocks: SearchReplaceBlock[];
  errors: string[];
}

export interface ApplyResult {
  success: boolean;
  newContent: string;
  appliedCount: number;
  errors: ApplyError[];
}

export interface ApplyError {
  blockIndex: number;
  search: string;
  error: 'not_found' | 'multiple_matches' | 'already_applied';
  matchCount?: number;
  suggestion?: string;
}

// ============================================================
// Parser
// ============================================================

const SEARCH_MARKER = '<<<<<<< SEARCH';
const DIVIDER_MARKER = '=======';
const REPLACE_MARKER = '>>>>>>> REPLACE';

/**
 * Parse SEARCH/REPLACE blocks from text
 *
 * Format:
 * <<<<<<< SEARCH
 * [content to find]
 * =======
 * [replacement content]
 * >>>>>>> REPLACE
 */
export function parseSearchReplaceBlocks(text: string): ParseResult {
  const blocks: SearchReplaceBlock[] = [];
  const errors: string[] = [];

  // Also support file-wrapped blocks
  // <file path="src/foo.ts">
  // <<<<<<< SEARCH
  // ...
  // </file>

  const fileBlockRegex = /<file\s+path=["']([^"']+)["']>([\s\S]*?)<\/file>/g;
  const simpleBlockRegex = new RegExp(
    `${escapeRegex(SEARCH_MARKER)}\\n([\\s\\S]*?)\\n${escapeRegex(DIVIDER_MARKER)}\\n([\\s\\S]*?)\\n${escapeRegex(REPLACE_MARKER)}`,
    'g'
  );

  // Process file-wrapped blocks first
  let match: RegExpExecArray | null;
  const processedRanges: Array<[number, number]> = [];

  while ((match = fileBlockRegex.exec(text)) !== null) {
    const filePath = match[1];
    const fileContent = match[2];
    processedRanges.push([match.index, match.index + match[0].length]);

    // Parse blocks within file content
    let innerMatch: RegExpExecArray | null;
    const innerRegex = new RegExp(simpleBlockRegex.source, 'g');

    while ((innerMatch = innerRegex.exec(fileContent)) !== null) {
      const search = innerMatch[1];
      const replace = innerMatch[2];

      if (search.trim() === '') {
        errors.push(`Empty search block in file ${filePath}`);
        continue;
      }

      blocks.push({ search, replace, filePath });
    }
  }

  // Process standalone blocks (not in file tags)
  let textWithoutFiles = text;
  // Remove processed file blocks to avoid duplicate processing
  for (const [start, end] of processedRanges.reverse()) {
    textWithoutFiles = textWithoutFiles.slice(0, start) + textWithoutFiles.slice(end);
  }

  while ((match = simpleBlockRegex.exec(textWithoutFiles)) !== null) {
    const search = match[1];
    const replace = match[2];

    if (search.trim() === '') {
      errors.push('Empty search block found');
      continue;
    }

    blocks.push({ search, replace });
  }

  return { blocks, errors };
}

/**
 * Apply search/replace blocks to content
 */
export function applySearchReplaceBlocks(
  content: string,
  blocks: SearchReplaceBlock[]
): ApplyResult {
  let newContent = content;
  let appliedCount = 0;
  const errors: ApplyError[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const result = applySingleBlock(newContent, block.search, block.replace, i);

    if (result.success) {
      newContent = result.content;
      appliedCount++;
    } else {
      errors.push(result.error!);
    }
  }

  return {
    success: errors.length === 0,
    newContent,
    appliedCount,
    errors,
  };
}

/**
 * Apply a single search/replace operation
 */
function applySingleBlock(
  content: string,
  search: string,
  replace: string,
  blockIndex: number
): { success: boolean; content: string; error?: ApplyError } {
  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const normalizedSearch = search.replace(/\r\n/g, '\n');
  const normalizedReplace = replace.replace(/\r\n/g, '\n');

  // Check if already applied (idempotency)
  if (normalizedContent.includes(normalizedReplace) && !normalizedContent.includes(normalizedSearch)) {
    return {
      success: true, // Consider it a success - already done
      content,
      error: {
        blockIndex,
        search: truncate(search, 50),
        error: 'already_applied',
      },
    };
  }

  // Count matches
  const matchCount = countOccurrences(normalizedContent, normalizedSearch);

  if (matchCount === 0) {
    // Try fuzzy match for suggestion
    const suggestion = findSimilarText(normalizedContent, normalizedSearch);

    return {
      success: false,
      content,
      error: {
        blockIndex,
        search: truncate(search, 50),
        error: 'not_found',
        suggestion,
      },
    };
  }

  if (matchCount > 1) {
    return {
      success: false,
      content,
      error: {
        blockIndex,
        search: truncate(search, 50),
        error: 'multiple_matches',
        matchCount,
      },
    };
  }

  // Apply replacement
  const newContent = normalizedContent.replace(normalizedSearch, normalizedReplace);

  return {
    success: true,
    content: newContent,
  };
}

// ============================================================
// Natural Language to Edit Commands
// ============================================================

export interface NaturalLanguageEdit {
  action: 'replace' | 'insert' | 'delete' | 'append' | 'unknown';
  target?: string;
  content?: string;
  position?: 'before' | 'after' | 'start' | 'end';
  lineNumber?: number;
}

/**
 * Parse common natural language edit patterns
 * (This is a heuristic - AI should still use formal blocks)
 */
export function parseNaturalLanguageEdit(text: string): NaturalLanguageEdit | null {
  const lowerText = text.toLowerCase();

  // "Replace X with Y"
  const replaceMatch = text.match(/replace\s+['""]?(.+?)['""]?\s+with\s+['""]?(.+?)['""]?$/i);
  if (replaceMatch) {
    return {
      action: 'replace',
      target: replaceMatch[1],
      content: replaceMatch[2],
    };
  }

  // "Add X to the end"
  if (lowerText.includes('add') && (lowerText.includes('end') || lowerText.includes('bottom'))) {
    return {
      action: 'append',
      content: extractContent(text),
    };
  }

  // "Insert X at line N"
  const insertLineMatch = text.match(/insert\s+(.+?)\s+(?:at|on)\s+line\s+(\d+)/i);
  if (insertLineMatch) {
    return {
      action: 'insert',
      content: insertLineMatch[1],
      lineNumber: parseInt(insertLineMatch[2], 10),
    };
  }

  // "Delete line N" or "Remove line N"
  const deleteLineMatch = text.match(/(?:delete|remove)\s+line\s+(\d+)/i);
  if (deleteLineMatch) {
    return {
      action: 'delete',
      lineNumber: parseInt(deleteLineMatch[1], 10),
    };
  }

  // "Delete X" or "Remove X"
  const deleteMatch = text.match(/(?:delete|remove)\s+['""]?(.+?)['""]?$/i);
  if (deleteMatch) {
    return {
      action: 'delete',
      target: deleteMatch[1],
    };
  }

  return null;
}

// ============================================================
// Utility Functions
// ============================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text: string, search: string): number {
  if (search === '') return 0;
  return (text.split(search).length - 1);
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

function extractContent(text: string): string {
  // Try to extract quoted content
  const quotedMatch = text.match(/['""](.+?)['""]|`(.+?)`/);
  if (quotedMatch) {
    return quotedMatch[1] || quotedMatch[2];
  }
  return '';
}

/**
 * Find similar text in content (for suggestions)
 */
function findSimilarText(content: string, search: string): string | undefined {
  const searchLines = search.trim().split('\n');
  const firstLine = searchLines[0].trim();
  const lastLine = searchLines[searchLines.length - 1].trim();

  // Try to find a line that starts similarly
  const contentLines = content.split('\n');

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i].trim();

    // Check if this line is similar to first line of search
    if (line.length > 0 && stringSimilarity(line, firstLine) > 0.7) {
      // Extract a chunk of similar length
      const chunk = contentLines.slice(i, i + searchLines.length).join('\n');
      if (chunk !== search) {
        return chunk;
      }
    }
  }

  return undefined;
}

/**
 * Simple string similarity (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Use bigram comparison for speed
  const bigramsA = new Set(bigrams(a));
  const bigramsB = new Set(bigrams(b));

  let intersection = 0;
  bigramsA.forEach(bg => {
    if (bigramsB.has(bg)) intersection++;
  });

  return (2.0 * intersection) / (bigramsA.size + bigramsB.size);
}

function bigrams(str: string): string[] {
  const result: string[] = [];
  const s = str.toLowerCase();
  for (let i = 0; i < s.length - 1; i++) {
    result.push(s.substring(i, i + 2));
  }
  return result;
}

// ============================================================
// Diff Generation (for display)
// ============================================================

export interface DiffLine {
  type: 'context' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
}

/**
 * Generate simple line-based diff for display
 */
export function generateSimpleDiff(
  oldContent: string,
  newContent: string,
  contextLines = 3
): DiffLine[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: DiffLine[] = [];

  // Simple diff: find changed regions
  // For production, use a proper diff library

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      // Rest are additions
      diff.push({ type: 'added', content: newLines[j], lineNumber: j + 1 });
      j++;
    } else if (j >= newLines.length) {
      // Rest are deletions
      diff.push({ type: 'removed', content: oldLines[i], lineNumber: i + 1 });
      i++;
    } else if (oldLines[i] === newLines[j]) {
      // Same line
      diff.push({ type: 'context', content: oldLines[i], lineNumber: i + 1 });
      i++;
      j++;
    } else {
      // Different - find where they sync up again
      // Simple approach: mark as removed then added
      diff.push({ type: 'removed', content: oldLines[i], lineNumber: i + 1 });
      diff.push({ type: 'added', content: newLines[j], lineNumber: j + 1 });
      i++;
      j++;
    }
  }

  // Filter to show only context around changes
  return filterDiffContext(diff, contextLines);
}

function filterDiffContext(diff: DiffLine[], contextLines: number): DiffLine[] {
  const result: DiffLine[] = [];
  const changeIndices = new Set<number>();

  // Find change indices
  diff.forEach((line, idx) => {
    if (line.type !== 'context') {
      changeIndices.add(idx);
    }
  });

  // Include context around changes
  const includeIndices = new Set<number>();
  changeIndices.forEach(idx => {
    for (let i = Math.max(0, idx - contextLines); i <= Math.min(diff.length - 1, idx + contextLines); i++) {
      includeIndices.add(i);
    }
  });

  // Build result
  let lastIncluded = -1;
  diff.forEach((line, idx) => {
    if (includeIndices.has(idx)) {
      // Add separator if there's a gap
      if (lastIncluded !== -1 && idx - lastIncluded > 1) {
        result.push({ type: 'context', content: '...' });
      }
      result.push(line);
      lastIncluded = idx;
    }
  });

  return result;
}
