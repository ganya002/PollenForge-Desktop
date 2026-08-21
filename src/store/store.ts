import { create } from 'zustand'
import { emptyProviderConfig } from '../lib/providerCatalog'

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
  enabled_providers: string[]
  installed_plugins: string[]
  active_plugins: string[]
  plugin_options?: Record<string, string>
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
  availableUpdate: string | null
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
  setAvailableUpdate: (version: string | null) => void
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
      pollinations: emptyProviderConfig('pollinations'),
    },
    enabled_providers: ['pollinations'],
    installed_plugins: [],
    active_plugins: [],
    model: 'gpt-5.6-sol',
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
  availableUpdate: null,
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
  setAvailableUpdate: (availableUpdate) => set({ availableUpdate }),
}))
