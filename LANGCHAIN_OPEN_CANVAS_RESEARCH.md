# LangChain Open Canvas - Architecture Research Report

**Research Date:** 2025-11-28
**Repository:** https://github.com/langchain-ai/open-canvas
**License:** MIT
**Stars:** ~5.1k | **Tech Stack:** TypeScript 98.4%, Next.js, LangGraph

---

## Executive Summary

LangChain's Open Canvas is an open-source alternative to OpenAI's Canvas, built as a collaborative document editing interface powered by LLM agents. The architecture separates concerns between a Next.js frontend and a LangGraph-based agent backend, using Web Workers for streaming and React Context for state management. Their approach uses **tool-calling for artifact generation**, **context-aware prompts for edits**, and **version-tracked artifact history** rather than traditional diff/patch mechanisms.

**Key Differentiators:**
- Built-in reflection agent for memory/style rules
- Version history tracking (not diff-based)
- Tool-calling forced schema for artifact generation
- Web Worker-based streaming architecture
- LangGraph state machine for agent orchestration

---

## 1. Repository Structure

### Monorepo Organization

```
open-canvas/
├── apps/
│   ├── web/              # Next.js frontend (React, TypeScript)
│   └── agents/           # LangGraph agent server
├── packages/
│   └── shared/           # Shared types, utilities, constants
└── static/               # Assets and screenshots
```

**Key Directories:**
- `/apps/web/src/contexts/GraphContext.tsx` - Core state management
- `/apps/web/src/workers/graph-stream/` - Streaming worker implementation
- `/apps/agents/src/open-canvas/` - LangGraph agent nodes and state
- `/packages/shared/src/types.ts` - Shared type definitions

---

## 2. Canvas State Architecture

### State Structure: ArtifactV3

```typescript
export interface ArtifactV3 {
  currentIndex: number;
  contents: (ArtifactMarkdownV3 | ArtifactCodeV3)[];
}

export interface ArtifactMarkdownV3 {
  index: number;
  type: "text";
  title: string;
  fullMarkdown: string;
}

export interface ArtifactCodeV3 {
  index: number;
  type: "code";
  title: string;
  language: ProgrammingLanguageOptions;
  code: string;
}
```

**Key Design Decisions:**

1. **Version Array, Not Diffs:** Artifacts store complete content snapshots in a `contents[]` array, not incremental changes
2. **Index-Based Navigation:** `currentIndex` points to the active version
3. **Type Discrimination:** Code vs. text handled via `type` discriminator
4. **Immutable Updates:** Each edit creates a new entry with incremented index

### GraphContext State Management

The frontend uses a centralized **GraphContext** (React Context API) managing:

```typescript
interface GraphContextValue {
  // Artifact state
  artifact: ArtifactV3 | undefined;
  setArtifact: Dispatch<SetStateAction<ArtifactV3 | undefined>>;

  // Message history
  messages: BaseMessage[];
  setMessages: Dispatch<SetStateAction<BaseMessage[]>>;

  // Streaming state
  isStreaming: boolean;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  firstTokenReceived: boolean;

  // Selection state
  selectedBlocks: TextHighlight | undefined;
  setSelectedBlocks: Dispatch<SetStateAction<TextHighlight | undefined>>;

  // Core streaming function
  streamMessage: (params: GraphInput) => Promise<void>;

  // Utilities
  setArtifactContent: (index: number, content: string) => void;
  clearState: () => void;
  switchSelectedThread: (thread: Thread) => void;
}
```

**State Update Pattern:**
- Debounced artifact updates (5000ms) to batch changes
- Immutable state updates throughout
- Web Worker isolation for streaming to prevent main thread blocking

---

## 3. Streaming Architecture

### Three-Tier Streaming System

```
Frontend (GraphContext)
    ↓ postMessage
Web Worker (StreamWorkerService)
    ↓ LangGraph SDK
Backend (LangGraph Agent)
```

### StreamWorkerService Implementation

**File:** `/apps/web/src/workers/graph-stream/streamWorker.ts`

```typescript
export class StreamWorkerService {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(new URL("./stream.worker.ts", import.meta.url));
  }

  async *streamData(config: StreamConfig): AsyncGenerator<any> {
    this.worker.postMessage(config);

    while (true) {
      const message: StreamWorkerMessage = await new Promise((resolve) => {
        this.worker.onmessage = (e) => resolve(e.data);
      });

      if (message.type === "error") throw new Error(message.error);
      if (message.type === "chunk") yield JSON.parse(message.data!);
      if (message.type === "done") break;
    }
  }

  terminate() {
    this.worker.terminate();
  }
}
```

### Stream Worker (`stream.worker.ts`)

```typescript
self.addEventListener("message", async (event) => {
  try {
    const { threadId, assistantId, input, modelName, modelConfigs } = event.data;
    const client = createClient();

    const stream = client.runs.stream(threadId, assistantId, {
      input: input as Record<string, unknown>,
      streamMode: "events",  // LangGraph event streaming
      config: {
        configurable: {
          customModelName: modelName,
          modelConfig: modelConfigs[modelName],
        },
      },
    });

    for await (const chunk of stream) {
      self.postMessage({
        type: "chunk",
        data: JSON.stringify(chunk),
      });
    }

    self.postMessage({ type: "done" });
  } catch (error) {
    self.postMessage({ type: "error", error: error.message });
  }
});
```

### Event Processing in GraphContext

**File:** `/apps/web/src/contexts/GraphContext.tsx`

The `streamMessageV2` function handles three primary event types:

#### 1. `on_chat_model_stream` - Token-by-Token Streaming

```typescript
for await (const chunk of stream) {
  const { event, langgraphNode, nodeChunk } = extractChunkFields(chunk);

  if (event === "on_chat_model_stream") {
    // Different handling per node
    switch (langgraphNode) {
      case "generateFollowup":
      case "replyToGeneralInput":
        // Accumulate message chunks
        setMessages((prev) =>
          replaceOrInsertMessageChunk(prev, nodeChunk)
        );
        break;

      case "generateArtifact":
        // Accumulate tool call arguments
        generateArtifactToolCallStr += nodeChunk.tool_call_chunks?.[0]?.args || "";

        // Rate-limited artifact updates
        if (shouldUpdate) {
          const parsedArgs = JSON.parse(generateArtifactToolCallStr);
          const newContent = createArtifactContent(parsedArgs);
          // Update artifact in state
        }
        break;

      case "updateArtifact":
      case "updateHighlightedText":
        // Progressive content accumulation
        if (!updatedArtifactStartContent) {
          updatedArtifactStartContent = nodeChunk.content;
        } else {
          updatedArtifactRestContent += nodeChunk.content;
        }

        // Apply to artifact
        setArtifact((prev) =>
          updateHighlightedCode(prev, content, newIndex, prevContent, isFirstUpdate)
        );
        break;

      case "rewriteArtifact":
        // Accumulate complete rewrite
        fullNewArtifactContent += nodeChunk.content;
        break;
    }
  }
}
```

#### 2. `on_chain_end` - Node Completion

```typescript
if (event === "on_chain_end") {
  const { langgraphNode, nodeOutput } = extractChunkFields(chunk);

  switch (langgraphNode) {
    case "rewriteArtifact":
      // Extract metadata updates
      rewriteArtifactMeta = nodeOutput.artifactMetaToolCall;
      break;

    case "generateArtifact":
      // Finalize artifact from tool call
      const toolCall = nodeOutput.messages[0].tool_calls?.[0];
      const newArtifact = createArtifactFromToolCall(toolCall);
      setArtifact(newArtifact);
      break;

    case "webSearch":
      // Map search results to message
      webSearchResults = nodeOutput.webSearchResults;
      break;
  }
}
```

#### 3. `on_chain_start` - Node Initialization

```typescript
if (event === "on_chain_start") {
  if (langgraphNode === "webSearch") {
    // Initialize web search UI
    webSearchMessageId = nodeChunk.id;
  }
}
```

### Message Chunk Accumulation Utility

**File:** `/apps/web/src/contexts/utils.ts`

```typescript
export const replaceOrInsertMessageChunk = (
  prevMessages: BaseMessage[],
  newMessageChunk: BaseMessageChunk
): BaseMessage[] => {
  const existingMessageIndex = prevMessages.findIndex(
    (msg) => msg.id === newMessageChunk.id
  );

  if (existingMessageIndex !== -1) {
    // Update existing message by concatenating content
    return [
      ...prevMessages.slice(0, existingMessageIndex),
      new AIMessage({
        ...prevMessages[existingMessageIndex],
        content:
          (prevMessages[existingMessageIndex]?.content || "") +
          (newMessageChunk?.content || ""),
      }),
      ...prevMessages.slice(existingMessageIndex + 1),
    ];
  } else {
    // Insert new message
    return [...prevMessages, new AIMessage({ ...newMessageChunk })];
  }
};
```

---

## 4. Edit Command Syntax & Approach

### NOT Diff-Based - Context + Prompt Approach

LangChain **does not use traditional diff/patch syntax**. Instead, they use:

1. **Context Extraction:** Provide surrounding code/text
2. **Targeted Prompts:** Specialized prompts per edit type
3. **Full Content Replacement:** Return updated sections, not diffs

### Highlighted Code Edit Flow

**File:** `/apps/agents/src/open-canvas/nodes/updateArtifact.ts`

```typescript
export const updateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const currentArtifactContent = getArtifactContent(state.artifact);

  // Extract context window (500 chars before/after)
  const start = Math.max(0, state.highlightedCode.startCharIndex - 500);
  const end = Math.min(
    currentArtifactContent.code.length,
    state.highlightedCode.endCharIndex + 500
  );

  const beforeHighlight = currentArtifactContent.code.slice(
    start,
    state.highlightedCode.startCharIndex
  );

  const highlightedText = currentArtifactContent.code.slice(
    state.highlightedCode.startCharIndex,
    state.highlightedCode.endCharIndex
  );

  const afterHighlight = currentArtifactContent.code.slice(
    state.highlightedCode.endCharIndex,
    end
  );

  // Format prompt with context
  const formattedPrompt = UPDATE_HIGHLIGHTED_ARTIFACT_PROMPT
    .replace("{highlightedText}", highlightedText)
    .replace("{beforeHighlight}", beforeHighlight)
    .replace("{afterHighlight}", afterHighlight)
    .replace("{reflections}", memoriesAsString);

  // Get updated content from LLM
  const response = await model.invoke([
    new SystemMessage(formattedPrompt),
    ...state.messages
  ]);

  const updatedContent = response.content;

  // Reconstruct full artifact
  const entireTextBefore = currentArtifactContent.code.slice(
    0,
    state.highlightedCode.startCharIndex
  );
  const entireTextAfter = currentArtifactContent.code.slice(
    state.highlightedCode.endCharIndex
  );

  const newCode = entireTextBefore + updatedContent + entireTextAfter;

  // Create new artifact version
  return {
    artifact: {
      ...state.artifact,
      currentIndex: state.artifact.contents.length,
      contents: [
        ...state.artifact.contents,
        {
          ...currentArtifactContent,
          index: state.artifact.contents.length,
          code: newCode,
        },
      ],
    },
  };
};
```

### Edit Prompts

**File:** `/apps/agents/src/open-canvas/prompts.ts`

#### Partial Edit (Highlighted Section)

```typescript
export const UPDATE_HIGHLIGHTED_ARTIFACT_PROMPT = `
You are an AI assistant, and the user has requested you make an update
to a specific part of an artifact you generated in the past.

Here is the relevant part of the artifact, with the highlighted text
between <highlight> tags:

{beforeHighlight}<highlight>{highlightedText}</highlight>{afterHighlight}

<reflections>
{reflections}
</reflections>

IMPORTANT: ONLY respond with the updated text, not the entire artifact.
Do not wrap the content in markdown code blocks unless it was already
wrapped in the highlighted text.
`;
```

#### Full Rewrite

```typescript
export const UPDATE_ENTIRE_ARTIFACT_PROMPT = `
You are tasked with rewriting an artifact based on the user's request.

Current artifact:
{currentArtifact}

<reflections>
{reflections}
</reflections>

Respond with the ENTIRE updated artifact, with no additional text
before and after. Do not wrap code in triple backticks.
`;
```

### GraphInput Command Structure

**File:** `/packages/shared/src/types.ts`

```typescript
export interface GraphInput {
  messages?: Record<string, any>[];

  // Selection context
  highlightedCode?: CodeHighlight;
  highlightedText?: TextHighlight;

  // Quick actions (trigger specific nodes)
  language?: LanguageOptions;              // Translate
  artifactLength?: ArtifactLengthOptions;  // Adjust length
  regenerateWithEmojis?: boolean;          // Add emojis
  readingLevel?: ReadingLevelOptions;      // Adjust reading level
  addComments?: boolean;                   // Add code comments
  addLogs?: boolean;                       // Add logging
  portLanguage?: ProgrammingLanguageOptions; // Convert language
  fixBugs?: boolean;                       // Fix bugs
  customQuickActionId?: string;            // Custom action

  // Features
  webSearchEnabled?: boolean;
  webSearchResults?: SearchResult[];

  // State
  artifact?: ArtifactV3;
  next?: string;  // Routing control
}
```

**Usage Example:**

```typescript
// Add comments to code
await streamMessage({
  addComments: true,
});

// Translate to Spanish
await streamMessage({
  language: "spanish",
});

// Edit highlighted code with message
await streamMessage({
  messages: [convertToOpenAIFormat(userMessage)],
  highlightedCode: {
    startCharIndex: 100,
    endCharIndex: 250,
  },
});
```

---

## 5. LangGraph Agent Architecture

### Graph Structure (16 Nodes)

**File:** `/apps/agents/src/open-canvas/index.ts`

```typescript
export const graph = new StateGraph(OpenCanvasGraphAnnotation)
  // Entry point
  .addNode("generatePath", generatePath)

  // Artifact operations
  .addNode("generateArtifact", generateArtifact)
  .addNode("updateArtifact", updateArtifact)
  .addNode("updateHighlightedText", updateHighlightedText)
  .addNode("rewriteArtifact", rewriteArtifact)
  .addNode("rewriteArtifactTheme", rewriteArtifactTheme)
  .addNode("rewriteCodeArtifactTheme", rewriteCodeArtifactTheme)
  .addNode("customAction", customAction)

  // Conversation
  .addNode("replyToGeneralInput", replyToGeneralInput)
  .addNode("generateFollowup", generateFollowup)

  // Features
  .addNode("webSearch", webSearchGraph)

  // Memory & context
  .addNode("reflect", reflectNode)
  .addNode("summarizer", summarizer)
  .addNode("conditionallyGenerateTitle", generateTitleNode)

  // Utilities
  .addNode("cleanState", cleanState)
  .addNode("routeNode", routeNode)

  // Edges
  .addEdge(START, "generatePath")
  .addEdge("generatePath", "routeNode")
  .addConditionalEdges("routeNode", (state) => state.next)
  // ... more edges
  .compile();
```

### State Annotation

**File:** `/apps/agents/src/open-canvas/state.ts`

```typescript
export const OpenCanvasGraphAnnotation = Annotation.Root({
  // Messages (inherited from MessagesAnnotation)
  messages: Annotation<BaseMessage[]>,
  _messages: Annotation<BaseMessage[]>,  // For summarization

  // Artifact state
  artifact: Annotation<ArtifactV3 | undefined>,

  // User selections
  highlightedCode: Annotation<CodeHighlight | undefined>,
  highlightedText: Annotation<TextHighlight | undefined>,

  // Routing
  next: Annotation<string | undefined>,

  // Quick action flags
  language: Annotation<LanguageOptions | undefined>,
  artifactLength: Annotation<ArtifactLengthOptions | undefined>,
  regenerateWithEmojis: Annotation<boolean | undefined>,
  readingLevel: Annotation<ReadingLevelOptions | undefined>,
  addComments: Annotation<boolean | undefined>,
  addLogs: Annotation<boolean | undefined>,
  portLanguage: Annotation<ProgrammingLanguageOptions | undefined>,
  fixBugs: Annotation<boolean | undefined>,
  customQuickActionId: Annotation<string | undefined>,

  // Web search
  webSearchEnabled: Annotation<boolean | undefined>,
  webSearchResults: Annotation<SearchResult[] | undefined>,
});
```

### Node Pattern: generateArtifact

**File:** `/apps/agents/src/open-canvas/nodes/generate-artifact/index.ts`

```typescript
export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const smallModel = await getModelFromConfig(config, {
    temperature: 0,
    isToolCalling: true,
  });

  // Force tool calling with schema
  const modelWithArtifactTool = smallModel.bindTools(
    [{
      name: "generate_artifact",
      description: ARTIFACT_TOOL_SCHEMA.description,
      schema: ARTIFACT_TOOL_SCHEMA,
    }],
    { tool_choice: "generate_artifact" }  // Force tool use
  );

  const prompt = formatNewArtifactPrompt(memoriesAsString, modelName);

  const response = await modelWithArtifactTool.invoke([
    new SystemMessage(prompt),
    ...state.messages,
  ]);

  // Extract tool call
  const args = response.tool_calls?.[0].args as z.infer<typeof ARTIFACT_TOOL_SCHEMA>;

  // Create artifact
  const artifactContent = createArtifactContent(args);
  const newArtifact: ArtifactV3 = {
    currentIndex: 0,
    contents: [{ ...artifactContent, index: 0 }],
  };

  return {
    artifact: newArtifact,
    messages: [response],
  };
};
```

### Tool Schema for Artifacts

**File:** `/apps/agents/src/open-canvas/nodes/generate-artifact/schemas.ts`

```typescript
export const ARTIFACT_TOOL_SCHEMA = z.object({
  type: z
    .enum(["code", "text"])
    .describe("The content type of the artifact generated."),

  language: z
    .enum(PROGRAMMING_LANGUAGES.map((lang) => lang.language))
    .optional()
    .describe(
      "The language/programming language of the artifact generated. " +
      "If generating code, it should be one of the options, or 'other'. " +
      "If not generating code, the language should ALWAYS be 'other'."
    ),

  isValidReact: z
    .boolean()
    .optional()
    .describe(
      "Whether or not the generated code is valid React code. " +
      "Only populate this field if generating code."
    ),

  artifact: z
    .string()
    .describe("The content of the artifact to generate."),

  title: z
    .string()
    .describe("A short title to give to the artifact. Should be less than 5 words."),
});
```

### Routing Logic

**File:** `/apps/agents/src/open-canvas/nodes/generate-path/index.ts`

```typescript
export const generatePath = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<Partial<typeof OpenCanvasGraphAnnotation.State>> => {
  // Check for quick actions first
  if (state.language) return { next: "rewriteArtifactTheme" };
  if (state.artifactLength) return { next: "rewriteArtifactTheme" };
  if (state.addComments) return { next: "rewriteCodeArtifactTheme" };
  if (state.addLogs) return { next: "rewriteCodeArtifactTheme" };
  if (state.portLanguage) return { next: "rewriteCodeArtifactTheme" };
  if (state.fixBugs) return { next: "rewriteCodeArtifactTheme" };
  if (state.customQuickActionId) return { next: "customAction" };

  // Check for highlighted edits
  if (state.highlightedCode) return { next: "updateArtifact" };
  if (state.highlightedText) return { next: "updateHighlightedText" };

  // Check for web search
  if (state.webSearchEnabled) return { next: "webSearch" };

  // Dynamic routing via LLM
  const route = await dynamicDeterminePath({ state, config });
  return { next: route };  // "generateArtifact", "rewriteArtifact", or "replyToGeneralInput"
};
```

---

## 6. Chat-Canvas Integration

### Layout Architecture

**File:** `/apps/web/src/components/canvas/canvas.tsx`

```typescript
export function CanvasComponent() {
  const { graphData } = useGraphContext();
  const { artifact, chatStarted } = graphData;

  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen">
      {/* Chat Panel */}
      {chatStarted && !chatCollapsed && (
        <ResizablePanel
          id="chat-panel"
          order={1}
          defaultSize={25}
          minSize={15}
          maxSize={50}
        >
          <ContentComposerChatInterface
            userId={user?.id}
            chatStarted={chatStarted}
          />
        </ResizablePanel>
      )}

      {/* Resize Handle */}
      {chatStarted && !chatCollapsed && <ResizableHandle />}

      {/* Canvas Panel */}
      <ResizablePanel
        id="canvas-panel"
        order={2}
        defaultSize={chatCollapsed ? 100 : 75}
        minSize={50}
        maxSize={85}
        className="transition-all duration-700"
      >
        {artifact ? (
          <ArtifactRenderer
            artifact={artifact}
            userId={user?.id}
            assistantId={selectedAssistant?.assistant_id}
          />
        ) : (
          <EmptyCanvasPlaceholder onCreateArtifact={handleCreate} />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

### Shared State via Context

```typescript
// Both chat and canvas consume the same GraphContext
const { graphData } = useGraphContext();
const {
  artifact,
  messages,
  streamMessage,
  setArtifact,
  isStreaming,
} = graphData;
```

### Message Flow

```
User types in chat
  ↓
ContentComposerChatInterface calls streamMessage()
  ↓
GraphContext.streamMessage() invokes StreamWorkerService
  ↓
Backend LangGraph processes
  ↓
Streaming events update GraphContext state
  ↓
Both chat (messages) and canvas (artifact) re-render reactively
```

### Artifact Renderer

**File:** `/apps/web/src/components/artifacts/ArtifactRenderer.tsx`

```typescript
function ArtifactRendererComponent(props: ArtifactRendererProps) {
  const { graphData } = useGraphContext();
  const { artifact, isStreaming, streamMessage } = graphData;

  return (
    <div className="artifact-container">
      <ArtifactHeader artifact={artifact} />

      {artifact.type === "code" ? (
        <CodeRenderer
          code={getArtifactContent(artifact).code}
          language={getArtifactContent(artifact).language}
          isStreaming={isStreaming}
        />
      ) : (
        <TextRenderer
          markdown={getArtifactContent(artifact).fullMarkdown}
          isStreaming={isStreaming}
        />
      )}

      <ActionsToolbar
        streamMessage={streamMessage}
        artifact={artifact}
      />
    </div>
  );
}
```

### Quick Actions Integration

**File:** `/apps/web/src/components/artifacts/actions_toolbar/code/index.tsx`

```typescript
export function CodeToolbar({ streamMessage, language }: CodeToolbarProps) {
  return (
    <div className="toolbar">
      <TooltipIconButton
        tooltip="Add comments"
        onClick={() => streamMessage({ addComments: true })}
      >
        <MessageSquare />
      </TooltipIconButton>

      <TooltipIconButton
        tooltip="Add logs"
        onClick={() => streamMessage({ addLogs: true })}
      >
        <FileText />
      </TooltipIconButton>

      <TooltipIconButton
        tooltip="Fix bugs"
        onClick={() => streamMessage({ fixBugs: true })}
      >
        <Bug />
      </TooltipIconButton>

      <PortToLanguageOptions
        streamMessage={streamMessage}
        language={language}
      />
    </div>
  );
}
```

---

## 7. Key Architectural Patterns

### 1. Version History Over Diffs

**Pattern:**
```typescript
// NOT: Apply diff patches
// YES: Store complete snapshots

interface ArtifactV3 {
  currentIndex: number;
  contents: ArtifactContent[];  // Full snapshots
}

// Navigate versions
const currentContent = artifact.contents[artifact.currentIndex];
const previousContent = artifact.contents[artifact.currentIndex - 1];
```

**Tradeoffs:**
- Pros: Simple to implement, easy undo/redo, no merge conflicts
- Cons: Higher memory usage for large documents

### 2. Tool-Calling Forced Schema

**Pattern:**
```typescript
const model = await getModel();
const modelWithTool = model.bindTools(
  [{ name: "generate_artifact", schema: ARTIFACT_TOOL_SCHEMA }],
  { tool_choice: "generate_artifact" }  // Force usage
);

const response = await modelWithTool.invoke(messages);
const artifact = response.tool_calls[0].args;
```

**Benefits:**
- Structured output guaranteed
- Type-safe artifact creation
- Validation via Zod schemas

### 3. Context Window for Edits

**Pattern:**
```typescript
// Extract 500 chars before/after selection
const contextBefore = code.slice(
  Math.max(0, selectionStart - 500),
  selectionStart
);

const contextAfter = code.slice(
  selectionEnd,
  Math.min(code.length, selectionEnd + 500)
);

// Provide to LLM
const prompt = `
Before: ${contextBefore}
<highlight>${selectedText}</highlight>
After: ${contextAfter}
`;
```

**Benefits:**
- LLM understands surrounding context
- Better quality edits
- No need for complex diff parsing

### 4. Web Worker Streaming

**Pattern:**
```typescript
// Isolate streaming in Web Worker to prevent UI blocking
class StreamWorkerService {
  async *streamData(config) {
    this.worker.postMessage(config);

    while (true) {
      const msg = await waitForMessage();
      if (msg.type === "chunk") yield JSON.parse(msg.data);
      if (msg.type === "done") break;
    }
  }
}
```

**Benefits:**
- Non-blocking UI
- Better performance for long generations
- Clean separation of concerns

### 5. Event-Based State Updates

**Pattern:**
```typescript
for await (const chunk of stream) {
  switch (chunk.event) {
    case "on_chat_model_stream":
      // Incremental updates
      setArtifact(prev => updateWithChunk(prev, chunk));
      break;

    case "on_chain_end":
      // Finalize with complete output
      setArtifact(createFinalArtifact(chunk.output));
      break;
  }
}
```

**Benefits:**
- Real-time UI updates
- Progressive rendering
- Handles both streaming and non-streaming models

### 6. Debounced Persistence

**Pattern:**
```typescript
// Debounce artifact updates to API
const debouncedAPIUpdate = useMemo(
  () => debounce((artifact: ArtifactV3) => {
    apiClient.updateArtifact(artifact);
  }, 5000),
  []
);

useEffect(() => {
  if (artifact) debouncedAPIUpdate(artifact);
}, [artifact]);
```

**Benefits:**
- Reduces API calls during rapid streaming
- Better performance
- Still maintains real-time UI updates

### 7. LangGraph State Machine

**Pattern:**
```typescript
const graph = new StateGraph(OpenCanvasGraphAnnotation)
  .addNode("generatePath", generatePath)
  .addNode("updateArtifact", updateArtifact)
  .addConditionalEdges("generatePath", (state) => state.next)
  .compile();

// Execution
await graph.invoke({ messages, artifact });
```

**Benefits:**
- Clear control flow
- Easy to add new nodes
- Built-in checkpointing and resumption
- Human-in-the-loop support

---

## 8. Comparison to Traditional Diff Approaches

| Aspect | Open Canvas | Traditional Diff (e.g., git diff) |
|--------|-------------|-----------------------------------|
| **Edit Format** | Context + prompt | Unified diff / patch file |
| **Application** | LLM regenerates section | Apply patch algorithmically |
| **Storage** | Full content snapshots | Incremental changes |
| **Undo/Redo** | Index navigation | Reverse patches |
| **Merge Conflicts** | N/A (single user) | Common in multi-user |
| **Validation** | Zod schemas | Manual/none |
| **Streaming** | Progressive content updates | Not applicable |

**Why They Chose This Approach:**

1. LLMs work better with natural language instructions + context than diff syntax
2. Version history is simpler than maintaining patch chains
3. Single-user use case (no concurrent editing)
4. Streaming requires incremental content, not diffs
5. Tool calling provides structured output guarantees

---

## 9. Code Examples: Complete Flows

### Example 1: Generate New Artifact

```typescript
// User sends message
const userMessage = new HumanMessage({
  content: "Create a React component for a todo list",
  id: uuidv4(),
});

// Frontend invokes streaming
await streamMessage({
  messages: [convertToOpenAIFormat(userMessage)],
});

// Backend flow:
// 1. generatePath → determines "generateArtifact"
// 2. generateArtifact node:
const response = await modelWithTool.invoke([
  new SystemMessage(GENERATE_ARTIFACT_PROMPT),
  ...messages,
]);

const toolCall = response.tool_calls[0];
// toolCall.args = {
//   type: "code",
//   language: "tsx",
//   title: "Todo List Component",
//   artifact: "import React from 'react'...",
// }

const artifact: ArtifactV3 = {
  currentIndex: 0,
  contents: [{
    index: 0,
    type: "code",
    language: "tsx",
    title: "Todo List Component",
    code: toolCall.args.artifact,
  }],
};

// 3. Frontend receives streaming events:
// on_chat_model_stream → accumulates tool call args
// on_chain_end → finalizes artifact

// 4. GraphContext updates:
setArtifact(artifact);
setMessages([...messages, response]);
```

### Example 2: Edit Highlighted Code

```typescript
// User selects lines 10-20 in code editor
const selection = {
  startCharIndex: 245,
  endCharIndex: 389,
};

// User sends edit request
const editMessage = new HumanMessage({
  content: "Add error handling to this function",
  id: uuidv4(),
});

// Frontend invokes
await streamMessage({
  messages: [convertToOpenAIFormat(editMessage)],
  highlightedCode: selection,
});

// Backend flow:
// 1. generatePath → detects highlightedCode → routes to "updateArtifact"
// 2. updateArtifact node:

// Extract context
const code = artifact.contents[artifact.currentIndex].code;
const beforeContext = code.slice(
  Math.max(0, selection.startCharIndex - 500),
  selection.startCharIndex
);
const selectedCode = code.slice(
  selection.startCharIndex,
  selection.endCharIndex
);
const afterContext = code.slice(
  selection.endCharIndex,
  Math.min(code.length, selection.endCharIndex + 500)
);

// Invoke LLM with context
const prompt = UPDATE_HIGHLIGHTED_ARTIFACT_PROMPT
  .replace("{beforeHighlight}", beforeContext)
  .replace("{highlightedText}", selectedCode)
  .replace("{afterHighlight}", afterContext);

const response = await model.invoke([
  new SystemMessage(prompt),
  editMessage,
]);

// Reconstruct code
const newCode =
  code.slice(0, selection.startCharIndex) +
  response.content +  // Updated section
  code.slice(selection.endCharIndex);

// Create new version
const newArtifact: ArtifactV3 = {
  currentIndex: artifact.contents.length,
  contents: [
    ...artifact.contents,
    {
      ...artifact.contents[artifact.currentIndex],
      index: artifact.contents.length,
      code: newCode,
    },
  ],
};

// 3. Frontend receives streaming:
// on_chat_model_stream → progressively updates highlighted section
// on_chain_end → finalizes new artifact version
```

### Example 3: Quick Action - Add Comments

```typescript
// User clicks "Add Comments" button
await streamMessage({
  addComments: true,
});

// Backend flow:
// 1. generatePath → detects addComments → routes to "rewriteCodeArtifactTheme"
// 2. rewriteCodeArtifactTheme node:

const currentCode = artifact.contents[artifact.currentIndex].code;

const prompt = ADD_COMMENTS_TO_CODE_ARTIFACT_PROMPT.replace(
  "{artifact}",
  currentCode
);

const response = await model.invoke([
  new SystemMessage(prompt),
  ...messages,
]);

// Create new version with comments
const newArtifact: ArtifactV3 = {
  currentIndex: artifact.contents.length,
  contents: [
    ...artifact.contents,
    {
      ...artifact.contents[artifact.currentIndex],
      index: artifact.contents.length,
      code: response.content,  // Code with comments added
    },
  ],
};

// Frontend progressively shows commented code streaming in
```

---

## 10. Source Code References

### Core Files

1. **GraphContext** (Frontend State Management)
   `/apps/web/src/contexts/GraphContext.tsx`
   Lines: ~1500
   Key: `streamMessageV2()`, `useGraphContext()`

2. **StreamWorkerService** (Web Worker Streaming)
   `/apps/web/src/workers/graph-stream/streamWorker.ts`
   Lines: ~30
   Key: `streamData()` async generator

3. **Stream Worker** (LangGraph SDK Integration)
   `/apps/web/src/workers/graph-stream/stream.worker.ts`
   Lines: ~40
   Key: `client.runs.stream()` with event mode

4. **OpenCanvasGraphAnnotation** (Agent State)
   `/apps/agents/src/open-canvas/state.ts`
   Lines: ~120
   Key: State schema definition

5. **LangGraph Index** (Agent Graph Definition)
   `/apps/agents/src/open-canvas/index.ts`
   Lines: ~200
   Key: Graph nodes, edges, routing

6. **generateArtifact Node** (Tool-Calling Generation)
   `/apps/agents/src/open-canvas/nodes/generate-artifact/index.ts`
   Lines: ~100
   Key: Forced tool calling with schema

7. **updateArtifact Node** (Highlighted Edit)
   `/apps/agents/src/open-canvas/nodes/updateArtifact.ts`
   Lines: ~150
   Key: Context extraction, edit application

8. **Prompts** (Edit Instructions)
   `/apps/agents/src/open-canvas/prompts.ts`
   Lines: ~500
   Key: All prompt templates

9. **Type Definitions** (Shared Types)
   `/packages/shared/src/types.ts`
   Lines: ~300
   Key: `ArtifactV3`, `GraphInput`, etc.

10. **Canvas Component** (UI Layout)
    `/apps/web/src/components/canvas/canvas.tsx`
    Lines: ~200
    Key: `ResizablePanelGroup` layout

### Architecture Diagrams (Conceptual)

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────┐         ┌─────────────────────────────┐  │
│  │  Chat Panel   │◄────────┤   GraphContext (React)      │  │
│  │  (Messages)   │         │   - artifact: ArtifactV3    │  │
│  └───────────────┘         │   - messages: BaseMessage[] │  │
│                            │   - streamMessage()         │  │
│  ┌───────────────┐         └─────────────┬───────────────┘  │
│  │ Canvas Panel  │                       │                   │
│  │  (Artifact)   │◄──────────────────────┘                   │
│  └───────────────┘                       │                   │
│                                           │                   │
└───────────────────────────────────────────┼───────────────────┘
                                            │
                                            ▼
                              ┌──────────────────────────┐
                              │  StreamWorkerService     │
                              │  (Web Worker)            │
                              └────────────┬─────────────┘
                                           │
                              postMessage  │  LangGraph SDK
                                           │  client.runs.stream()
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (LangGraph Agent)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│   START                                                       │
│     │                                                         │
│     ▼                                                         │
│  ┌──────────────┐         ┌─────────────────────────────┐   │
│  │ generatePath │────────►│  Conditional Router         │   │
│  └──────────────┘         └─────────────┬───────────────┘   │
│                                          │                    │
│              ┌───────────────────────────┼────────────┐      │
│              │                           │            │      │
│              ▼                           ▼            ▼      │
│     ┌────────────────┐       ┌───────────────┐  ┌─────────┐ │
│     │ generateArtifact│       │ updateArtifact│  │ rewrite │ │
│     │  (Tool Call)   │       │  (Context+LLM)│  │Artifact │ │
│     └────────┬───────┘       └───────┬───────┘  └────┬────┘ │
│              │                       │               │       │
│              └───────────────────────┼───────────────┘       │
│                                      ▼                        │
│                          ┌────────────────────┐              │
│                          │ generateFollowup   │              │
│                          └──────────┬─────────┘              │
│                                     ▼                         │
│                          ┌────────────────────┐              │
│                          │   reflect (async)  │              │
│                          └──────────┬─────────┘              │
│                                     ▼                         │
│                                    END                        │
│                                                               │
│  Streaming Events:                                           │
│  • on_chat_model_stream → Progressive chunks                 │
│  • on_chain_end → Finalization                               │
│  • on_chain_start → Initialization                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Recommendations for Implementation

Based on this research, here are key takeaways for building a similar system:

### 1. State Management

**Adopt:**
- Version array instead of diffs (simpler, more reliable)
- Immutable updates throughout
- Debounced API persistence

**Avoid:**
- Complex diff/patch libraries unless multi-user
- Mutable state updates (breaks React rendering)

### 2. Streaming

**Adopt:**
- Web Worker isolation for streaming
- Event-based chunk processing
- Progressive UI updates during generation

**Consider:**
- Server-Sent Events (SSE) as alternative to Web Workers
- WebSocket for bidirectional communication

### 3. Edit Approach

**Adopt:**
- Context window extraction (500 chars before/after)
- Specialized prompts per edit type
- Tool calling for structured output

**Avoid:**
- Trying to teach LLMs diff syntax (less reliable)
- Applying diffs client-side (error-prone)

### 4. Agent Architecture

**Adopt:**
- State machine pattern (LangGraph or similar)
- Conditional routing based on flags
- Node-based operation separation

**Alternative:**
- Simpler chain-of-thought for single-operation use cases
- Direct API calls if no complex routing needed

### 5. UI/UX

**Adopt:**
- Resizable split-pane layout
- Real-time artifact rendering during streaming
- Quick action buttons for common operations

**Enhance:**
- Add visual diff view for version comparison
- Collaborative features (if multi-user)

---

## 12. Additional Resources

- **GitHub Repository:** https://github.com/langchain-ai/open-canvas
- **Live Demo:** https://opencanvas.langchain.com
- **LangGraph Docs:** https://www.langchain.com/langgraph
- **DeepWiki Analysis:** https://deepwiki.com/langchain-ai/open-canvas

---

## Research Methodology

This report was compiled through:
1. GitHub repository code search (mcp__grep__searchGitHub)
2. Direct file fetching from GitHub (WebFetch)
3. Web search for architectural discussions (WebSearch)
4. Manual code analysis and pattern identification

**Confidence Level:** High - Based on direct source code examination as of November 2025.

---

**End of Report**
