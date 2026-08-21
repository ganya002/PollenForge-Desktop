import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  stats?: MessageStats
  isError?: boolean
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  result?: unknown
  status: 'pending' | 'running' | 'done' | 'error' | 'approval_needed'
  startedAt?: number
  durationMs?: number
}

export interface MessageStats {
  tokens: number
  duration_ms: number
  model: string
  provider: string
  tools_used: number
  iterations?: number
}

export interface Session {
  id: string
  name: string
  created: string
  modified: string
  message_count: number
  updated_at?: number
}

export interface Config {
  providers: Record<string, ProviderConfig>
  model: string
  provider: string
  temperature: number
  max_tokens: number
  auto_approve: boolean
}

export interface ProviderConfig {
  api_key: string
  base_url?: string
  models: ModelInfo[]
}

export interface ModelInfo {
  id: string
  name: string
  cost_per_1k: number
  context_length: number
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  is_dir?: boolean
  size: number | null
  modified: number
  git_status?: 'modified' | 'new' | 'deleted' | 'untracked'
  children?: FileEntry[]
  expanded?: boolean
  child_count?: number | string
}

export interface Worktree {
  path: string
  branch: string
  head: string
  bare?: boolean
}

export interface BackgroundTask {
  id: string
  name: string
  command: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'timeout'
  exit_code: number | null
  created_at: number
  duration_ms?: number
}

export interface PendingApproval {
  toolCallId: string
  tool: string
  args: Record<string, unknown>
  requestId: string
}

export interface DiffEntry {
  path: string
  diff: string
  has_changes: boolean
}

interface AppState {
  messages: Message[]
  currentModel: string
  currentProvider: string
  isStreaming: boolean
  sidebarOpen: boolean
  sessions: Session[]
  currentSessionId: string | null
  config: Config
  fileTree: FileEntry[]
  pendingApproval: PendingApproval | null
  wsConnected: boolean
  totalTokensUsed: number
  totalCost: number
  worktrees: Worktree[]
  tasks: BackgroundTask[]
  diffs: DiffEntry[]
  _wsSend: ((data: Record<string, unknown>) => boolean) | null

  addMessage: (msg: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  appendToLastMessage: (content: string) => void
  addToolCall: (messageId: string, toolCall: ToolCall) => void
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void
  setStreaming: (v: boolean) => void
  setModel: (model: string, provider: string) => void
  toggleSidebar: () => void
  setSessions: (sessions: Session[]) => void
  setConfig: (config: Config) => void
  setFileTree: (tree: FileEntry[]) => void
  clearMessages: () => void
  setCurrentSessionId: (id: string | null) => void
  loadSessionMessages: (msgs: { role: string; content: string; toolCalls?: ToolCall[]; stats?: MessageStats }[]) => void
  setPendingApproval: (approval: PendingApproval | null) => void
  setWsConnected: (v: boolean) => void
  addTokensUsed: (tokens: number, cost: number) => void
  approveTool: (approved: boolean) => void
  setWsSend: (fn: (data: Record<string, unknown>) => boolean) => void
  setWorktrees: (w: Worktree[]) => void
  setTasks: (t: BackgroundTask[]) => void
  setDiffs: (d: DiffEntry[]) => void
}

export const useStore = create<AppState>((set, get) => ({
  messages: [],
  currentModel: 'gpt-5.6-sol',
  currentProvider: 'pollinations',
  isStreaming: false,
  sidebarOpen: true,
  sessions: [],
  currentSessionId: null,
  config: {
    providers: {
      pollinations: {
        api_key: '',
        models: [
          { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', cost_per_1k: 0, context_length: 128000 },
          { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', cost_per_1k: 0, context_length: 128000 },
          { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', cost_per_1k: 0, context_length: 128000 },
          { id: 'openai-large', name: 'OpenAI Large', cost_per_1k: 0, context_length: 128000 },
          { id: 'kimi-k3', name: 'Kimi K3', cost_per_1k: 0, context_length: 128000 },
          { id: 'grok-large', name: 'Grok Large', cost_per_1k: 0, context_length: 128000 },
          { id: 'deepseek-pro', name: 'DeepSeek Pro', cost_per_1k: 0, context_length: 128000 },
          { id: 'glm', name: 'GLM', cost_per_1k: 0, context_length: 128000 },
          { id: 'gpt-4o', name: 'GPT-4o', cost_per_1k: 0, context_length: 128000 },
          { id: 'claude-hybridspace', name: 'Claude Hybridspace', cost_per_1k: 0, context_length: 200000 },
          { id: 'mistral', name: 'Mistral', cost_per_1k: 0, context_length: 128000 },
          { id: 'gemini', name: 'Gemini', cost_per_1k: 0, context_length: 1048576 },
          { id: 'llama', name: 'Llama', cost_per_1k: 0, context_length: 128000 },
          { id: 'qwen-coder', name: 'Qwen Coder', cost_per_1k: 0, context_length: 128000 },
          { id: 'deepseek', name: 'DeepSeek', cost_per_1k: 0, context_length: 128000 },
          { id: 'kimi-k2.6', name: 'Kimi K2.6', cost_per_1k: 0, context_length: 128000 },
          { id: 'grok', name: 'Grok', cost_per_1k: 0, context_length: 128000 },
        ],
      },
      openai: {
        api_key: '',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', cost_per_1k: 0.005, context_length: 128000 },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', cost_per_1k: 0.00015, context_length: 128000 },
          { id: 'o3', name: 'o3', cost_per_1k: 0.01, context_length: 200000 },
        ],
      },
      anthropic: {
        api_key: '',
        models: [
          { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', cost_per_1k: 0.003, context_length: 200000 },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', cost_per_1k: 0.003, context_length: 200000 },
        ],
      },
      google: {
        api_key: '',
        models: [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost_per_1k: 0.0001, context_length: 1048576 },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', cost_per_1k: 0.00125, context_length: 1048576 },
        ],
      },
      ollama: {
        api_key: '',
        base_url: 'http://localhost:11434',
        models: [],
      },
      openrouter: {
        api_key: '',
        base_url: 'https://openrouter.ai/api/v1',
        models: [
          { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OR)', cost_per_1k: 0.003, context_length: 200000 },
          { id: 'openai/gpt-4o', name: 'GPT-4o (OR)', cost_per_1k: 0.005, context_length: 128000 },
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OR)', cost_per_1k: 0.00015, context_length: 128000 },
          { id: 'openai/o3-mini', name: 'o3-mini (OR)', cost_per_1k: 0.0011, context_length: 128000 },
          { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder (OR)', cost_per_1k: 0.00014, context_length: 128000 },
          { id: 'deepseek/deepseek-v3', name: 'DeepSeek V3 (OR)', cost_per_1k: 0.00027, context_length: 128000 },
          { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B (OR)', cost_per_1k: 0.0002, context_length: 128000 },
          { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B (OR)', cost_per_1k: 0.003, context_length: 128000 },
          { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (OR)', cost_per_1k: 0.0001, context_length: 1048576 },
          { id: 'mistralai/codestral-latest', name: 'Codestral (OR)', cost_per_1k: 0.00025, context_length: 32000 },
        ],
      },
    },
    model: 'pollinations',
    provider: 'pollinations',
    temperature: 0.4,
    max_tokens: 32768,
    auto_approve: true,
  },
  fileTree: [],
  pendingApproval: null,
  wsConnected: false,
  totalTokensUsed: 0,
  totalCost: 0,
  worktrees: [],
  tasks: [],
  diffs: [],
  _wsSend: null,

  addMessage: (msg) => set((s) => {
    // Cap at 500 messages to prevent OOM
    const next = [...s.messages, msg]
    if (next.length > 500) next.shift()
    return { messages: next }
  }),
  updateMessage: (id, updates) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  appendToLastMessage: (content) => set((s) => {
    if (s.messages.length === 0) return s
    const last = s.messages[s.messages.length - 1]
    if (last.role !== 'assistant') return s
    const updated = { ...last, content: (last.content || '') + content }
    return { messages: [...s.messages.slice(0, -1), updated] }
  }),
  addToolCall: (messageId, toolCall) => set((s) => ({
    messages: s.messages.map(m => m.id === messageId ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] } : m)
  })),
  updateToolCall: (messageId, toolCallId, updates) => set((s) => ({
    messages: s.messages.map(m => {
      if (m.id !== messageId || !m.toolCalls) return m
      return { ...m, toolCalls: m.toolCalls.map(tc => tc.id === toolCallId ? { ...tc, ...updates } : tc) }
    })
  })),
  setStreaming: (v) => set({ isStreaming: v }),
  setModel: (model, provider) => set({ currentModel: model, currentProvider: provider }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSessions: (sessions) => set({ sessions }),
  setConfig: (config) => set({ config }),
  setFileTree: (tree) => set({ fileTree: tree }),
  clearMessages: () => set({ messages: [] }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  loadSessionMessages: (msgs) => set({
    messages: msgs.map((m, i) => ({
      id: `loaded-${Date.now()}-${i}`,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: Date.now() - (msgs.length - i) * 1000,
      toolCalls: (m as any).toolCalls,
      stats: (m as any).stats,
    })),
  }),
  setPendingApproval: (approval) => set({ pendingApproval: approval }),
  setWsConnected: (v) => set({ wsConnected: v }),
  setWsSend: (fn) => set({ _wsSend: fn }),
  addTokensUsed: (tokens, cost) =>
    set((s) => ({
      totalTokensUsed: s.totalTokensUsed + tokens,
      totalCost: s.totalCost + cost,
    })),
  approveTool: (approved) => {
    const state = get()
    const approval = state.pendingApproval
    if (!approval) return
    if (state._wsSend) {
      state._wsSend({ type: 'approve', request_id: approval.requestId, approved })
    }
    set({ pendingApproval: null })
  },
  setWorktrees: (worktrees) => set({ worktrees }),
  setTasks: (tasks) => set({ tasks }),
  setDiffs: (diffs) => set({ diffs }),
}))
