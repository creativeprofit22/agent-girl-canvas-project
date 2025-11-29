# Document State Management and Versioning Research

Research Date: 2025-11-28
Focus: Lightweight implementations for document editors

---

## Executive Summary

This research examines state management patterns for document editors, focusing on lightweight, memory-efficient implementations suitable for single-user scenarios. Key findings:

- **Undo/Redo**: Command pattern with two-stack approach is optimal for text editors
- **Collaborative Editing**: CRDT complexity rarely justified for single-user; OT remains dominant
- **Client-Side Storage**: IndexedDB superior to localStorage for documents, with critical performance optimizations
- **Diff/Patch**: Myers algorithm (via jsdiff library) provides best balance of performance and quality
- **Versioning**: Hybrid snapshot-delta approach (like Mercurial) offers optimal memory efficiency

---

## 1. Undo/Redo Implementation Patterns

### 1.1 Core Approaches

#### Command Pattern (Two-Stack Approach) - RECOMMENDED
Most efficient for text editors. Store reversible operations rather than full states.

**Data Structure:**
```javascript
class UndoManager {
  constructor() {
    this.undoStack = [];  // Commands that can be undone
    this.redoStack = [];  // Commands that can be redone
    this.maxLength = 50;  // Memory limit
  }
}
```

**Command Structure:**
```javascript
interface Command {
  type: 'INSERT' | 'DELETE' | 'REPLACE';
  position: number;
  text?: string;
  length?: number;
  timestamp?: number;
  cursorBefore?: CursorState;
  cursorAfter?: CursorState;
}
```

**Operation Flow:**
1. User performs action → create command → push to undoStack → clear redoStack
2. Undo: pop from undoStack → execute reverse → push to redoStack
3. Redo: pop from redoStack → execute forward → push to undoStack

**Memory Optimization - Operation Merging:**
```javascript
recordCommand(command) {
  const last = this.undoStack[this.undoStack.length - 1];

  // Merge consecutive similar operations (e.g., typing)
  if (last &&
      last.type === command.type &&
      last.position + last.text?.length === command.position &&
      Date.now() - last.timestamp < 500) { // Within 500ms
    last.text += command.text;
    last.timestamp = Date.now();
    return;
  }

  this.undoStack.push(command);
  this.redoStack = []; // Clear redo on new action

  // Enforce depth limit
  if (this.undoStack.length > this.maxLength) {
    this.undoStack.shift();
  }
}
```

**Key Implementation (ACE Editor Pattern):**
```javascript
class UndoManager {
  execute(delta) {
    if (this.lastDeltas) {
      this.lastDeltas.push(delta);
    } else {
      this.$undoStack.push(this.lastDeltas = [delta]);
      delta.id = this.$rev++;
    }

    if (this.$undoStack.length > this.$undoDepth) {
      this.$undoStack.splice(0,
        this.$undoStack.length - this.$undoDepth + 1);
    }
  }

  undo(dontSelect) {
    const deltas = this.$undoStack.pop();
    let undoSelectionRange = null;

    if (deltas) {
      undoSelectionRange =
        this.session.undoChanges(deltas, dontSelect);
      this.$redoStack.push(deltas);
    }

    return undoSelectionRange;
  }
}
```

**Advantages:**
- Memory efficient: ~5-10 KB per 100 operations
- Fast: O(1) for undo/redo operations
- Supports operation grouping/batching
- Cursor position tracking built-in

**Real-World Implementations:**
- ACE Editor: Delta-based with transformation support
- Trix Editor: Snapshot-based with consolidation
- Basecamp Trix: Uses composition snapshots

---

#### State Restoration Pattern (Memento)
Store complete document states. Simpler but memory-intensive.

**When to Use:**
- Small documents (< 100 KB)
- Simple data structures
- Framework integration (Redux)

**Implementation:**
```javascript
class StateUndoManager {
  constructor(maxHistory = 20) {
    this.states = [];
    this.currentIndex = -1;
    this.maxHistory = maxHistory;
  }

  save(state) {
    // Remove future states if we're not at the end
    this.states.splice(this.currentIndex + 1);

    // Clone state (deep copy)
    this.states.push(JSON.parse(JSON.stringify(state)));
    this.currentIndex++;

    // Enforce limit
    if (this.states.length > this.maxHistory) {
      this.states.shift();
      this.currentIndex--;
    }
  }

  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.states[this.currentIndex];
    }
    return null;
  }

  redo() {
    if (this.currentIndex < this.states.length - 1) {
      this.currentIndex++;
      return this.states[this.currentIndex];
    }
    return null;
  }
}
```

**Memory Impact:**
- ~Document size × maxHistory
- Example: 50 KB doc × 20 states = 1 MB memory

**Trade-off:** Simplified implementation vs. 10-20× memory overhead

---

### 1.2 Advanced Patterns

#### Undo Trees (Vim/Emacs Style)
Preserves all history branches when user undoes then makes new changes.

```javascript
class UndoTree {
  constructor() {
    this.root = { state: null, children: [], parent: null };
    this.current = this.root;
  }

  branch(state) {
    const node = {
      state,
      children: [],
      parent: this.current,
      timestamp: Date.now()
    };
    this.current.children.push(node);
    this.current = node;
  }

  undo() {
    if (this.current.parent) {
      this.current = this.current.parent;
      return this.current.state;
    }
  }
}
```

**Use Case:** Power users who want complete history navigation

---

### 1.3 Recommended Algorithm

**For Single-User Text Editors:**
```javascript
class LightweightUndoManager {
  constructor(options = {}) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxDepth = options.maxDepth || 50;
    this.mergeTimeout = options.mergeTimeout || 500; // ms
    this.lastCommand = null;
  }

  record(command) {
    // Attempt to merge with last command
    if (this.canMerge(command)) {
      this.mergeCommands(this.lastCommand, command);
      return;
    }

    // Add new command
    this.undoStack.push(command);
    this.redoStack = [];
    this.lastCommand = command;

    // Enforce depth limit
    while (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
  }

  canMerge(command) {
    if (!this.lastCommand) return false;

    const timeDiff = Date.now() - this.lastCommand.timestamp;
    if (timeDiff > this.mergeTimeout) return false;

    // Merge consecutive insertions at adjacent positions
    if (command.type === 'INSERT' &&
        this.lastCommand.type === 'INSERT' &&
        command.position === this.lastCommand.position +
                             this.lastCommand.text.length) {
      return true;
    }

    // Merge consecutive deletions
    if (command.type === 'DELETE' &&
        this.lastCommand.type === 'DELETE' &&
        command.position === this.lastCommand.position) {
      return true;
    }

    return false;
  }

  mergeCommands(last, current) {
    if (current.type === 'INSERT') {
      last.text += current.text;
    } else if (current.type === 'DELETE') {
      last.length += current.length;
      last.deletedText = (last.deletedText || '') + current.deletedText;
    }
    last.timestamp = Date.now();
  }

  undo() {
    if (this.undoStack.length === 0) return null;

    const command = this.undoStack.pop();
    this.redoStack.push(command);
    this.lastCommand = null;

    return this.reverseCommand(command);
  }

  redo() {
    if (this.redoStack.length === 0) return null;

    const command = this.redoStack.pop();
    this.undoStack.push(command);
    this.lastCommand = command;

    return command;
  }

  reverseCommand(command) {
    switch (command.type) {
      case 'INSERT':
        return {
          type: 'DELETE',
          position: command.position,
          length: command.text.length
        };
      case 'DELETE':
        return {
          type: 'INSERT',
          position: command.position,
          text: command.deletedText
        };
      case 'REPLACE':
        return {
          type: 'REPLACE',
          position: command.position,
          text: command.oldText,
          oldText: command.text
        };
    }
  }
}
```

**Memory Footprint:** ~100-200 bytes per command × 50 = ~5-10 KB

---

## 2. Collaborative Editing State Management

### 2.1 CRDT vs Operational Transform

#### Summary for Single-User Scenarios
**RECOMMENDATION: Skip both for single-user editors**

CRDTs and OT solve distributed consensus problems irrelevant to single-user scenarios. Standard undo/redo stacks are sufficient.

#### When Building Collaborative Features

**Operational Transform (OT)**
- **Status:** Industry standard (Google Docs, Office 365)
- **Complexity:** High - requires transformation functions
- **Architecture:** Central server controls operation ordering
- **Performance:** Operations are small, server manages conflicts

**CRDT (Conflict-free Replicated Data Types)**
- **Status:** Emerging (Zed editor, newer tools)
- **Complexity:** Moderate - data structure handles conflicts
- **Architecture:** Peer-to-peer, offline-first
- **Performance:** Larger metadata overhead, eventual consistency

**Academic Findings (2019):**
> "CRDT is like OT in following a general transformation approach, but achieves the same transformation indirectly, rather than directly as OT does. Moreover, CRDT is not natively commutative for concurrent operations in co-editors, as often claimed (a myth), but has to achieve the same OT commutativity indirectly as well."

Source: "Real Differences between OT and CRDT under a General Transformation Framework"

**Decision Matrix:**
```
Single user → Standard undo/redo
Small team, server available → OT (battle-tested)
Offline-first, P2P → CRDT
```

---

### 2.2 Lightweight OT for Future Proofing

If planning collaborative features, use this minimal OT structure:

```javascript
class SimpleOT {
  // Transform operation 'a' against operation 'b'
  transform(a, b) {
    if (a.type === 'INSERT' && b.type === 'INSERT') {
      if (a.position < b.position) {
        return a; // No change needed
      } else if (a.position > b.position) {
        return { ...a, position: a.position + b.text.length };
      } else {
        // Same position - server breaks tie
        return a;
      }
    }

    if (a.type === 'DELETE' && b.type === 'INSERT') {
      if (a.position >= b.position) {
        return { ...a, position: a.position + b.text.length };
      }
      return a;
    }

    if (a.type === 'INSERT' && b.type === 'DELETE') {
      if (a.position > b.position) {
        return { ...a, position: a.position - b.length };
      }
      return a;
    }

    // DELETE vs DELETE
    if (a.type === 'DELETE' && b.type === 'DELETE') {
      // Complex case - ranges may overlap
      return this.transformDeleteDelete(a, b);
    }

    return a;
  }
}
```

**Library Recommendation:** For production collaborative editing, use tested OT library:
- `ot.js` (3.8 KB gzipped) - https://github.com/Operational-Transformation/ot.js

---

## 3. Client-Side Storage: IndexedDB vs localStorage

### 3.1 Decision Matrix

| Factor | localStorage | IndexedDB |
|--------|-------------|-----------|
| **Size Limit** | 5-10 MB | 50 MB - unlimited |
| **Performance** | Synchronous (blocks UI) | Asynchronous |
| **Data Types** | Strings only | Structured data, Blobs |
| **Queries** | None | Indexes, cursors, ranges |
| **Versioning** | Manual | Built-in migration |
| **Transactions** | None | ACID transactions |
| **Use Case** | Settings, small state | Documents, history, files |

**Rule of Thumb:**
```
< 1 MB, simple key-value → localStorage
> 1 MB, structured data → IndexedDB
Documents with history → IndexedDB (always)
```

---

### 3.2 IndexedDB Performance Optimization

#### Critical Performance Patterns

**1. Batch Operations in Single Transaction**
```javascript
// BAD: Multiple transactions (10-100× slower)
for (const doc of documents) {
  const tx = db.transaction(['docs'], 'readwrite');
  tx.objectStore('docs').put(doc);
  await tx.complete;
}

// GOOD: Single transaction
const tx = db.transaction(['docs'], 'readwrite');
const store = tx.objectStore('docs');
for (const doc of documents) {
  store.put(doc);
}
await tx.complete;
```

**Performance Impact:** 2 seconds → 0.2 seconds for 1000 documents

---

**2. Use Relaxed Durability (Chrome/Safari)**
```javascript
// For autosave where data loss is acceptable
const tx = db.transaction(['docs'], 'readwrite', {
  durability: 'relaxed'  // Faster, less crash-safe
});

// For critical operations (default)
const tx = db.transaction(['docs'], 'readwrite', {
  durability: 'strict'  // Slower, crash-safe
});
```

**Use Cases:**
- `relaxed`: Autosave drafts, temporary data, recoverable state
- `strict`: Final save, user-initiated saves, critical data

---

**3. Paginated Reads (IndexedDB v2)**
```javascript
async function* paginateDocuments(store, batchSize = 100) {
  let lastKey = null;

  while (true) {
    const keyRange = lastKey
      ? IDBKeyRange.lowerBound(lastKey, true)
      : null;

    const keys = await store.getAllKeys(keyRange, batchSize);
    if (keys.length === 0) break;

    const values = await store.getAll(keyRange, batchSize);
    yield values;

    if (values.length < batchSize) break;
    lastKey = keys[keys.length - 1];
  }
}

// Usage
for await (const batch of paginateDocuments(store)) {
  processBatch(batch);
}
```

**Performance Gain:** 40-50% faster than cursor iteration, up to 20× in Safari

---

**4. Readonly vs Readwrite Transactions**
```javascript
// Multiple readonly transactions can run concurrently
const tx1 = db.transaction(['docs'], 'readonly');
const tx2 = db.transaction(['docs'], 'readonly'); // No wait

// Readwrite transactions lock the store
const tx3 = db.transaction(['docs'], 'readwrite');
const tx4 = db.transaction(['docs'], 'readwrite'); // Waits for tx3
```

**Best Practice:** Use readonly for all read operations to maximize concurrency

---

**5. Explicit Commit (IndexedDB v3)**
```javascript
const tx = db.transaction(['docs'], 'readwrite');
const store = tx.objectStore('docs');

store.put(doc1);
store.put(doc2);

// Signal immediate completion instead of waiting for event loop
if (tx.commit) {
  tx.commit();
}
```

**Performance Gain:** Marginal but useful for batch operations

---

### 3.3 Document Storage Schema

**Optimized Schema for Version History:**
```javascript
// Database structure
const dbSchema = {
  version: 1,
  stores: {
    // Current document states
    documents: {
      keyPath: 'id',
      indexes: {
        lastModified: 'lastModified',
        title: 'title'
      }
    },

    // Version history (delta-based)
    versions: {
      keyPath: ['documentId', 'version'],
      indexes: {
        documentId: 'documentId',
        timestamp: 'timestamp'
      }
    },

    // Snapshots (periodic full states)
    snapshots: {
      keyPath: ['documentId', 'version'],
      indexes: {
        documentId: 'documentId'
      }
    }
  }
};

// Document structure
interface Document {
  id: string;
  title: string;
  content: string;
  currentVersion: number;
  lastModified: number;
  lastSnapshot: number; // Version number of last snapshot
}

// Delta version (small)
interface Version {
  documentId: string;
  version: number;
  timestamp: number;
  changes: Delta[]; // Array of diffs
  author?: string;
}

// Periodic snapshot (larger, less frequent)
interface Snapshot {
  documentId: string;
  version: number;
  content: string; // Full content
  timestamp: number;
}
```

---

### 3.4 Autosave Implementation

```javascript
class DocumentAutosave {
  constructor(db, options = {}) {
    this.db = db;
    this.saveInterval = options.interval || 30000; // 30 seconds
    this.pendingChanges = new Map(); // documentId → changes[]
    this.saveTimer = null;
  }

  recordChange(documentId, change) {
    if (!this.pendingChanges.has(documentId)) {
      this.pendingChanges.set(documentId, []);
    }
    this.pendingChanges.get(documentId).push(change);

    // Debounced save
    this.scheduleSave();
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), this.saveInterval);
  }

  async flush() {
    if (this.pendingChanges.size === 0) return;

    const tx = this.db.transaction(['documents', 'versions'],
      'readwrite',
      { durability: 'relaxed' } // Fast autosave
    );

    const docStore = tx.objectStore('documents');
    const verStore = tx.objectStore('versions');

    for (const [docId, changes] of this.pendingChanges) {
      // Update document
      const doc = await docStore.get(docId);
      doc.currentVersion++;
      doc.lastModified = Date.now();
      await docStore.put(doc);

      // Store delta version
      await verStore.put({
        documentId: docId,
        version: doc.currentVersion,
        timestamp: Date.now(),
        changes: changes
      });
    }

    await tx.complete;
    this.pendingChanges.clear();
  }

  // User-initiated save uses strict durability
  async save(documentId) {
    const tx = this.db.transaction(['documents'], 'readwrite', {
      durability: 'strict' // Crash-safe
    });
    // ... save logic
  }
}
```

---

### 3.5 Alternative: OPFS (Origin Private File System)

**For 2024+:** File System Access API available in all modern browsers

```javascript
// ~4× faster than IndexedDB for large documents
const root = await navigator.storage.getDirectory();
const fileHandle = await root.getFileHandle('document.txt', { create: true });
const writable = await fileHandle.createWritable();
await writable.write(content);
await writable.close();
```

**Trade-offs:**
- **Pros:** 4× faster writes, simpler API, better for large files
- **Cons:** Less browser support, no structured queries, file-based

**Recommendation:** Use OPFS for:
- Large documents (> 10 MB)
- File-based workflows
- Performance-critical applications

---

## 4. Diff/Patch Algorithms

### 4.1 Myers Algorithm (Recommended)

**Algorithm:** O(ND) where N = length(a) + length(b), D = edit distance

**Why Myers:**
- Fast for typical text edits (greedy approach)
- Produces human-readable diffs
- Used by Git, GNU diff
- Well-tested implementations available

**How It Works:**
1. Models diff as graph search problem
2. X-axis = deletions, Y-axis = insertions, Diagonals = matches
3. Finds shortest path to transform source → target
4. Prefers deletions before insertions (better readability)

---

### 4.2 Lightweight Implementation

**Library: jsdiff**
- Size: 6.34 KB (minified + gzipped)
- Zero dependencies
- Multiple diff granularities

```javascript
import { diffChars, diffWords, diffLines, applyPatch,
         createPatch } from 'diff';

// Character-level diff (most precise)
const charDiff = diffChars('Hello World', 'Hello Node');
// Output: [
//   { value: 'Hello ', count: 6 },
//   { value: 'World', count: 5, removed: true },
//   { value: 'Node', count: 4, added: true }
// ]

// Word-level diff (balanced)
const wordDiff = diffWords('The quick brown fox',
                           'The fast brown fox');
// Output: [
//   { value: 'The ', count: 1 },
//   { value: 'quick ', removed: true },
//   { value: 'fast ', added: true },
//   { value: 'brown fox', count: 1 }
// ]

// Line-level diff (fastest, version control)
const lineDiff = diffLines(oldContent, newContent);

// Generate unified diff patch
const patch = createPatch('document.txt', oldContent, newContent);

// Apply patch
const result = applyPatch(originalContent, patch);
```

---

### 4.3 Custom Lightweight Diff (No Dependencies)

**For minimal implementations:**

```javascript
class SimpleDiff {
  // Basic diff for single-line edits (common case)
  diffStrings(oldStr, newStr) {
    // Find common prefix
    let prefixLen = 0;
    while (prefixLen < oldStr.length &&
           prefixLen < newStr.length &&
           oldStr[prefixLen] === newStr[prefixLen]) {
      prefixLen++;
    }

    // Find common suffix
    let suffixLen = 0;
    while (suffixLen < oldStr.length - prefixLen &&
           suffixLen < newStr.length - prefixLen &&
           oldStr[oldStr.length - 1 - suffixLen] ===
           newStr[newStr.length - 1 - suffixLen]) {
      suffixLen++;
    }

    const oldMid = oldStr.slice(prefixLen,
                                 oldStr.length - suffixLen);
    const newMid = newStr.slice(prefixLen,
                                 newStr.length - suffixLen);

    return {
      position: prefixLen,
      removed: oldMid,
      added: newMid,

      // Compact representation
      toCommand() {
        if (this.removed.length === 0) {
          return { type: 'INSERT', position: this.position,
                   text: this.added };
        }
        if (this.added.length === 0) {
          return { type: 'DELETE', position: this.position,
                   length: this.removed.length };
        }
        return { type: 'REPLACE', position: this.position,
                 oldText: this.removed, text: this.added };
      }
    };
  }

  // Apply diff to string
  patch(str, diff) {
    return str.slice(0, diff.position) +
           diff.added +
           str.slice(diff.position + diff.removed.length);
  }
}

// Usage
const differ = new SimpleDiff();
const diff = differ.diffStrings('Hello World', 'Hello Node');
console.log(diff.toCommand());
// { type: 'REPLACE', position: 6, oldText: 'World', text: 'Node' }
```

**Performance:** O(n) for typical edits, 50-100× faster than Myers for single edits

**Use Case:** Real-time typing, autosave deltas (not version history)

---

### 4.4 Algorithm Selection

```javascript
// Decision tree
function selectDiffAlgorithm(context) {
  if (context.realTimeTyping) {
    return 'simple-diff'; // Prefix/suffix matching
  }

  if (context.versionControl) {
    return 'myers-line-diff'; // jsdiff.diffLines
  }

  if (context.characterPrecision) {
    return 'myers-char-diff'; // jsdiff.diffChars
  }

  if (context.largeDocs) {
    return 'myers-word-diff'; // jsdiff.diffWords (balanced)
  }

  return 'myers-word-diff'; // Default
}
```

---

### 4.5 Delta Storage Format

**Compact representation for version storage:**

```javascript
interface CompactDelta {
  v: number;           // version
  t: number;           // timestamp
  o: [number, number, string][]; // operations: [pos, del, ins]
}

// Example: Replace "World" with "Node" at position 6
const delta = {
  v: 42,
  t: 1701234567890,
  o: [[6, 5, 'Node']]  // Delete 5 chars, insert "Node"
};

// Multi-operation delta
const complexDelta = {
  v: 43,
  t: 1701234600000,
  o: [
    [0, 0, 'Title: '],     // Insert at start
    [20, 3, ''],           // Delete 3 chars at 20
    [50, 0, '\n\nFooter']  // Insert at 50
  ]
};

// Compact encoding (30-50% size reduction)
function encodeDelta(delta) {
  return JSON.stringify([
    delta.v,
    delta.t,
    delta.o
  ]);
}
```

**Storage Size Comparison:**
- Full document: ~50 KB
- Unified diff patch: ~500 bytes
- Compact delta: ~100 bytes

---

## 5. Memory-Efficient Versioning

### 5.1 Snapshot-Delta Hybrid (Recommended)

**Algorithm:** Mercurial's adaptive approach

**Strategy:**
1. Store snapshots periodically
2. Store deltas between snapshots
3. Create new snapshot when delta chain exceeds threshold
4. Never apply more than N deltas to reconstruct

```javascript
class HybridVersionStore {
  constructor(options = {}) {
    this.snapshotInterval = options.snapshotInterval || 10; // versions
    this.maxDeltaSize = options.maxDeltaSize || 2; // × content size
    this.compressionEnabled = options.compress ?? true;
  }

  async saveVersion(documentId, content, previousVersion) {
    const version = (previousVersion?.version || 0) + 1;

    // Decide: snapshot or delta?
    const shouldSnapshot = await this.shouldCreateSnapshot(
      documentId, version, content, previousVersion
    );

    if (shouldSnapshot) {
      return this.createSnapshot(documentId, version, content);
    } else {
      return this.createDelta(documentId, version, content,
                              previousVersion);
    }
  }

  async shouldCreateSnapshot(docId, version, content, previous) {
    // First version always snapshot
    if (version === 1) return true;

    // Periodic snapshots
    if (version % this.snapshotInterval === 0) return true;

    // Delta chain too long
    const lastSnapshot = await this.getLastSnapshot(docId);
    const deltasSize = await this.getDeltasSize(docId,
                                                  lastSnapshot.version,
                                                  version);

    if (deltasSize > content.length * this.maxDeltaSize) {
      return true;
    }

    return false;
  }

  createSnapshot(docId, version, content) {
    const compressed = this.compressionEnabled
      ? this.compress(content)
      : content;

    return {
      type: 'snapshot',
      documentId: docId,
      version: version,
      content: compressed,
      size: compressed.length,
      timestamp: Date.now()
    };
  }

  createDelta(docId, version, newContent, previousVersion) {
    const diff = this.differ.diffStrings(
      previousVersion.content,
      newContent
    );

    return {
      type: 'delta',
      documentId: docId,
      version: version,
      baseVersion: previousVersion.version,
      operations: diff.toOperations(),
      size: JSON.stringify(diff.toOperations()).length,
      timestamp: Date.now()
    };
  }

  async reconstructVersion(docId, targetVersion) {
    // Find closest snapshot ≤ targetVersion
    const snapshot = await this.findClosestSnapshot(docId,
                                                      targetVersion);

    // Apply deltas sequentially
    let content = snapshot.content;
    const deltas = await this.getDeltas(docId,
                                        snapshot.version,
                                        targetVersion);

    for (const delta of deltas) {
      content = this.applyDelta(content, delta);
    }

    return content;
  }

  // Simple LZ-string compression
  compress(str) {
    // Use built-in CompressionStream API (modern browsers)
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(new TextEncoder().encode(str));
    writer.close();
    return stream.readable;
  }
}
```

---

### 5.2 Threshold Configuration

**Optimal Settings (based on Mercurial research):**

```javascript
const versioningConfig = {
  // Create snapshot every N versions
  snapshotInterval: 10,

  // Create snapshot if deltas exceed 2× content size
  maxDeltaMultiplier: 2.0,

  // Maximum deltas to apply for reconstruction
  maxDeltaChain: 10,

  // Compress snapshots (50-70% size reduction for text)
  compressSnapshots: true,

  // Don't compress deltas (already small)
  compressDeltas: false
};
```

**Memory Formula:**
```
Total Size = (Snapshots × ContentSize × 0.5) +
             (Deltas × AvgDeltaSize)

Example (100 versions, 50 KB document):
- Snapshots: 10 × 50KB × 0.5 = 250 KB
- Deltas: 90 × 1KB = 90 KB
- Total: 340 KB (vs 5 MB for full snapshots)
```

**Reconstruction Speed:**
```
Best case: 1 snapshot read (~10ms)
Worst case: 1 snapshot + 10 deltas (~50ms)
Average: 1 snapshot + 5 deltas (~30ms)
```

---

### 5.3 Storage Layout

```javascript
// IndexedDB schema optimized for hybrid versioning
const versionDbSchema = {
  snapshots: {
    keyPath: ['documentId', 'version'],
    indexes: {
      documentId: 'documentId'
    }
  },
  deltas: {
    keyPath: ['documentId', 'version'],
    indexes: {
      documentId: 'documentId',
      baseVersion: 'baseVersion'
    }
  },
  metadata: {
    keyPath: 'documentId',
    // Tracks: lastVersion, lastSnapshot, totalSize
  }
};

// Metadata structure
interface VersionMetadata {
  documentId: string;
  lastVersion: number;
  lastSnapshot: number;
  totalVersions: number;
  totalSize: number; // bytes
  oldestVersion: number;
}

// Query patterns
async function getVersionInfo(db, docId) {
  return await db.metadata.get(docId);
}

async function getClosestSnapshot(db, docId, version) {
  const snapshots = await db.snapshots
    .where('documentId').equals(docId)
    .and(s => s.version <= version)
    .reverse()
    .limit(1)
    .toArray();

  return snapshots[0];
}

async function getDeltasRange(db, docId, fromVersion, toVersion) {
  return await db.deltas
    .where('documentId').equals(docId)
    .and(d => d.version > fromVersion && d.version <= toVersion)
    .sortBy('version');
}
```

---

### 5.4 Garbage Collection

**Strategy:** Remove old versions when storage exceeds threshold

```javascript
class VersionGarbageCollector {
  constructor(options = {}) {
    this.maxVersions = options.maxVersions || 100;
    this.maxTotalSize = options.maxTotalSize || 10 * 1024 * 1024; // 10 MB
    this.keepSnapshots = options.keepSnapshots || 5; // minimum
  }

  async collect(db, documentId) {
    const metadata = await db.metadata.get(documentId);

    if (metadata.totalVersions <= this.maxVersions &&
        metadata.totalSize <= this.maxTotalSize) {
      return; // No collection needed
    }

    // Strategy: Remove oldest versions, keep snapshots
    const snapshots = await db.snapshots
      .where('documentId').equals(documentId)
      .sortBy('version');

    const snapshotsToKeep = snapshots.slice(-this.keepSnapshots);
    const oldestKeptVersion = snapshotsToKeep[0].version;

    // Delete old snapshots
    await db.snapshots
      .where('documentId').equals(documentId)
      .and(s => s.version < oldestKeptVersion)
      .delete();

    // Delete old deltas
    await db.deltas
      .where('documentId').equals(documentId)
      .and(d => d.version < oldestKeptVersion)
      .delete();

    // Update metadata
    await this.recalculateMetadata(db, documentId);
  }
}
```

---

## 6. Recommended Architecture

### 6.1 Complete System Design

```javascript
class DocumentEditor {
  constructor(options = {}) {
    this.db = null; // IndexedDB instance
    this.undoManager = new LightweightUndoManager({
      maxDepth: 50,
      mergeTimeout: 500
    });
    this.versionStore = new HybridVersionStore({
      snapshotInterval: 10,
      maxDeltaSize: 2,
      compress: true
    });
    this.autosave = new DocumentAutosave(this.db, {
      interval: 30000 // 30 seconds
    });

    this.currentDocument = null;
    this.isDirty = false;
  }

  async init() {
    this.db = await this.openDatabase();
  }

  // Handle user edits
  async edit(change) {
    // Apply change to document
    this.applyChange(this.currentDocument, change);
    this.isDirty = true;

    // Add to undo stack
    this.undoManager.record(change);

    // Schedule autosave (debounced)
    this.autosave.recordChange(this.currentDocument.id, change);
  }

  // Undo/redo (in-memory, instant)
  async undo() {
    const reverseCommand = this.undoManager.undo();
    if (reverseCommand) {
      this.applyChange(this.currentDocument, reverseCommand);
      this.isDirty = true;
    }
  }

  async redo() {
    const command = this.undoManager.redo();
    if (command) {
      this.applyChange(this.currentDocument, command);
      this.isDirty = true;
    }
  }

  // Manual save (creates version)
  async save() {
    const version = await this.versionStore.saveVersion(
      this.currentDocument.id,
      this.currentDocument.content,
      await this.getLatestVersion(this.currentDocument.id)
    );

    // Store in IndexedDB with strict durability
    const tx = this.db.transaction(['versions'], 'readwrite', {
      durability: 'strict'
    });
    await tx.objectStore('versions').put(version);
    await tx.complete;

    this.isDirty = false;
    return version;
  }

  // Load specific version
  async loadVersion(documentId, versionNumber) {
    const content = await this.versionStore.reconstructVersion(
      documentId,
      versionNumber
    );

    this.currentDocument = {
      id: documentId,
      content: content,
      version: versionNumber
    };

    // Reset undo/redo
    this.undoManager = new LightweightUndoManager();
  }

  // Version history
  async getVersionHistory(documentId, limit = 10) {
    const snapshots = await this.db.snapshots
      .where('documentId').equals(documentId)
      .reverse()
      .limit(limit)
      .toArray();

    return snapshots.map(s => ({
      version: s.version,
      timestamp: s.timestamp,
      type: 'snapshot'
    }));
  }
}
```

---

### 6.2 Memory Budget

**Target Configuration (for 10 MB document):**

```javascript
const memoryBudget = {
  // In-memory undo/redo
  undoStack: {
    maxCommands: 50,
    estimatedSize: 10 * 1024, // 10 KB
  },

  // Current document
  currentDocument: {
    estimatedSize: 10 * 1024 * 1024, // 10 MB
  },

  // IndexedDB cache (browser managed)
  indexedDBCache: {
    estimatedSize: 5 * 1024 * 1024, // 5 MB
  },

  // Total in-memory
  total: 15.01 * 1024 * 1024, // ~15 MB
};

// Version storage (IndexedDB, on-disk)
const storageConfig = {
  maxVersionsPerDocument: 100,
  estimatedVersionStorage: 500 * 1024, // 500 KB (hybrid approach)
  maxTotalStorage: 50 * 1024 * 1024, // 50 MB total
};
```

---

### 6.3 Performance Targets

```javascript
const performanceTargets = {
  // User interactions (must be < 16ms for 60fps)
  typing: '< 5ms',           // Single character
  undo: '< 10ms',            // Undo one command
  redo: '< 10ms',            // Redo one command

  // Autosave (background, debounced)
  autosave: '< 100ms',       // Save deltas to IndexedDB

  // Manual save
  manualSave: '< 500ms',     // Create version + store

  // Version operations
  loadVersion: '< 200ms',    // Reconstruct from snapshot + deltas
  versionHistory: '< 100ms', // Query version list

  // Memory
  memoryFootprint: '< 20 MB', // Total in-memory
  storagePerDoc: '< 1 MB',    // Version history per document
};
```

---

## 7. Implementation Checklist

### Phase 1: Core Functionality
- [ ] Implement command-based undo/redo manager
- [ ] Add operation merging for consecutive edits
- [ ] Set up IndexedDB with proper schema
- [ ] Implement basic autosave with debouncing

### Phase 2: Versioning
- [ ] Implement simple diff algorithm (prefix/suffix)
- [ ] Add delta storage for autosave
- [ ] Implement manual save with version creation
- [ ] Add version history query

### Phase 3: Optimization
- [ ] Switch to hybrid snapshot-delta versioning
- [ ] Add IndexedDB transaction batching
- [ ] Implement relaxed durability for autosave
- [ ] Add compression for snapshots

### Phase 4: Advanced Features
- [ ] Implement version garbage collection
- [ ] Add version comparison view (diff UI)
- [ ] Optimize with OPFS if needed
- [ ] Add cursor position tracking in undo/redo

---

## 8. Key Recommendations Summary

### Data Structures
1. **Undo/Redo:** Command pattern with two stacks, 50-command limit
2. **Commands:** `{ type, position, text/length, timestamp, cursor }`
3. **Versions:** Hybrid snapshot-delta, 10-version snapshot interval
4. **Deltas:** Compact format `[position, deleteLength, insertText]`

### Algorithms
1. **Diff:** jsdiff library (Myers) for version control, simple prefix/suffix for real-time
2. **Merge:** Time-based (500ms window) + position-based
3. **Reconstruction:** Closest snapshot + sequential delta application
4. **Garbage Collection:** Keep 5 newest snapshots, delete older versions

### Storage
1. **Undo/Redo:** In-memory only (not persisted)
2. **Current State:** IndexedDB with relaxed durability autosave
3. **Versions:** IndexedDB with strict durability on manual save
4. **Compression:** Enable for snapshots (50-70% reduction)

### Performance
1. **Batch IndexedDB:** Single transaction for multiple operations
2. **Use Readonly:** For all read-only operations (concurrency)
3. **Debounce Autosave:** 30-second interval, relaxed durability
4. **Pagination:** Use getAll() with keyRange for large queries
5. **Memory Limit:** 50-command undo stack, 100-version history

### Libraries (Optional)
- **jsdiff** (6.34 KB): Production-quality diff/patch
- **ot.js** (3.8 KB): If adding collaborative features
- **CompressionStream API**: Built-in browser compression

### Avoid
- Full state snapshots in undo/redo (10-20× memory overhead)
- CRDT/OT for single-user (unnecessary complexity)
- localStorage for documents > 1 MB (synchronous, slow)
- Multiple IndexedDB transactions (10-100× slower)
- Cursor iteration in IndexedDB (use getAll())

---

## 9. Source Citations

### Primary Sources

1. **Undo/Redo Patterns**
   - "Undo/redo implementations in text editors" - Matt Duck
     https://www.mattduck.com/undo-redo-text-editors
   - ACE Editor UndoManager implementation
     https://github.com/ajaxorg/ace/blob/master/src/undomanager.js
   - Trix Editor UndoManager
     https://github.com/basecamp/trix/blob/main/src/trix/models/undo_manager.js

2. **Collaborative Editing**
   - "Building Collaborative Interfaces: OT vs. CRDTs" (2024)
     https://dev.to/puritanic/building-collaborative-interfaces-operational-transforms-vs-crdts-2obo
   - "Real Differences between OT and CRDT" (2019) - ACM
     https://dl.acm.org/doi/10.1145/3375186
   - "How CRDTs make multiplayer text editing part of Zed's DNA"
     https://zed.dev/blog/crdts

3. **IndexedDB Performance**
   - "Speeding up IndexedDB reads and writes" - Nolan Lawson (2021)
     https://nolanlawson.com/2021/08/22/speeding-up-indexeddb-reads-and-writes/
   - "Solving IndexedDB Slowness for Seamless Apps" - RxDB
     https://rxdb.info/slow-indexeddb.html
   - "LocalStorage vs. IndexedDB vs. Cookies vs. OPFS"
     https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html

4. **Diff Algorithms**
   - "The Myers diff algorithm: part 1" - James Coglan (2017)
     https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/
   - Google Diff-Match-Patch library
     https://github.com/google/diff-match-patch
   - JSDiff library
     https://github.com/kpdecker/jsdiff

5. **Version Control Theory**
   - "How Snapshot and Delta Storage Differs"
     https://blog.git-init.com/snapshot-vs-delta-storage/
   - "Behind the scenes — Mercurial: the definitive guide"
     https://book.mercurial-scm.org/read/concepts.html
   - "Deltas" - Eric Sink Version Control by Example
     https://ericsink.com/vcbe/html/deltas.html

### Academic Papers
- Myers, Eugene W. "An O(ND) Difference Algorithm and Its Variations" (1986)
- "Real Differences between OT and CRDT under a General Transformation Framework for Consistency Maintenance in Co-Editors" - ACM (2019)

### API Documentation
- MDN Web Docs - IndexedDB API
  https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- MDN Web Docs - File System Access API
  https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API

---

## 10. Next Steps

### For Implementation
1. Start with Phase 1 (core undo/redo + IndexedDB)
2. Test with realistic document sizes (1-10 MB)
3. Measure actual performance against targets
4. Iterate on snapshot intervals based on usage patterns

### For Further Research
1. Investigate OPFS for very large documents (> 10 MB)
2. Benchmark different diff libraries with your specific use case
3. Consider WebAssembly implementations for performance-critical paths
4. Explore SharedArrayBuffer for multi-threaded diff processing

### For Production
1. Add error handling and recovery mechanisms
2. Implement conflict resolution for corrupted data
3. Add telemetry for autosave success rates
4. Create migration path for schema changes
5. Test IndexedDB quota management and user prompts

---

**Document Version:** 1.0
**Last Updated:** 2025-11-28
**Research Depth:** Comprehensive
**Recommended Review:** Every 6 months for new browser APIs
