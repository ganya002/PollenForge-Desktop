import { create } from 'zustand'
import { emptyProviderConfig } from '../lib/providerCatalog'
import type { AgentMode, ThemeId } from '../lib/qol'
import { rememberSessionId } from '../lib/sessionPersist'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  images?: string[]
  reasoning?: string
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
  directory?: string
  preview?: string
  pinned?: boolean
  archived?: boolean
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
  default_directory?: string
  free_models_only?: boolean
  model_list?: 'popular' | 'all' | 'free'
  theme?: ThemeId
  agent_mode?: AgentMode
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
  free?: boolean
  cost_in_per_1k?: number
  cost_out_per_1k?: number
  cost_currency?: 'usd' | 'pollen' | string
}

export interface OpenFile {
  path: string
  name: string
  content: string
  error?: string
  truncated?: boolean
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

export interface ToastItem {
  id: string
  kind: 'error' | 'info'
  text: string
}

export interface UndoWrite {
  path: string
  content: string
  root?: string | null
}

export interface Checkpoint {
  id: string
  label: string
  at: number
  messages: Message[]
}

export interface SwarmWorker {
  id: string
  role: string
  task: string
  content: string
  status: 'pending' | 'running' | 'done' | 'error'
    lastTool?: string
  lastPath?: string
  added?: number
  removed?: number
  toolsUsed?: number
  error?: string
}

export interface SwarmState {
  goal: string
  workers: SwarmWorker[]
  active: boolean
}

export interface RunProgress {
  iteration: number
  maxIterations: number
  toolsExecuted: number
  percent: number
  remainingTurns: number
  elapsedMs: number
  etaMs: number
  phase: string
  currentTool?: string
  currentPath?: string
  mutateCount?: number
  startedAt: number
}

interface AppState {
  messages: Message[]
  currentModel: string
  currentProvider: string
  isStreaming: boolean
  sidebarOpen: boolean
  browserOpen: boolean
  browserUrl: string
  browserFullscreen: boolean
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
  openFiles: OpenFile[]
  activeFilePath: string | null
  pendingWorkspace: string | null
  queuedMessage: string | null
  previewOffer: { url: string; label: string } | null
  browserTick: number
  toasts: ToastItem[]
  agentStep: string | null
  runProgress: RunProgress | null
  undoWrite: UndoWrite | null
  chatFind: string
  checkpoints: Checkpoint[]
  showArchived: boolean
  swarm: SwarmState | null
  _wsSend: ((data: Record<string, unknown>) => boolean) | null

  addMessage: (msg: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  appendToLastMessage: (content: string) => void
  appendToLastReasoning: (content: string) => void
  addToolCall: (messageId: string, toolCall: ToolCall) => void
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void
  setStreaming: (v: boolean) => void
  setModel: (model: string, provider: string) => void
  toggleSidebar: () => void
  toggleBrowser: () => void
  openInBrowser: (url: string) => void
  setBrowserUrl: (url: string) => void
  setBrowserFullscreen: (on: boolean) => void
  setSessions: (sessions: Session[]) => void
  setConfig: (config: Config) => void
  setFileTree: (tree: FileEntry[]) => void
  clearMessages: () => void
  setCurrentSessionId: (id: string | null) => void
  loadSessionMessages: (msgs: { role: string; content: string; reasoning?: string; toolCalls?: ToolCall[]; stats?: MessageStats }[]) => void
  setPendingApproval: (approval: PendingApproval | null) => void
  setWsConnected: (v: boolean) => void
  addTokensUsed: (tokens: number, cost: number) => void
  approveTool: (approved: boolean) => void
  setWsSend: (fn: (data: Record<string, unknown>) => boolean) => void
  setWorktrees: (w: Worktree[]) => void
  setTasks: (t: BackgroundTask[]) => void
  setDiffs: (d: DiffEntry[]) => void
  setAvailableUpdate: (version: string | null) => void
  upsertOpenFile: (file: OpenFile) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void
  setPendingWorkspace: (path: string | null) => void
  setQueuedMessage: (content: string | null) => void
  setPreviewOffer: (offer: { url: string; label: string } | null) => void
  bumpBrowser: () => void
  pushToast: (toast: Omit<ToastItem, 'id'> & { id?: string }) => void
  dismissToast: (id: string) => void
  setAgentStep: (step: string | null) => void
  setRunProgress: (progress: Omit<RunProgress, 'startedAt'> | RunProgress | null) => void
  setUndoWrite: (undo: UndoWrite | null) => void
  setChatFind: (query: string) => void
  addCheckpoint: (label?: string) => void
  restoreCheckpoint: (id: string) => void
  setShowArchived: (on: boolean) => void
  startSwarm: (payload: { goal?: string; workers: { id: string; role: string; task: string }[] }) => void
  appendSwarmToken: (id: string, content: string) => void
  setSwarmWorker: (id: string, updates: Partial<SwarmWorker>) => void
  endSwarm: () => void
  clearSwarm: () => void
}

export const useStore = create<AppState>((set, get) => ({
  messages: [],
  currentModel: 'gpt-5.6-sol',
  currentProvider: 'pollinations',
  isStreaming: false,
  sidebarOpen: true,
  browserOpen: false,
  browserUrl: '',
  browserFullscreen: false,
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
    model_list: 'popular',
    free_models_only: false,
    theme: 'dark',
    agent_mode: 'agent',
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
  openFiles: [],
  activeFilePath: null,
  pendingWorkspace: null,
  queuedMessage: null,
  previewOffer: null,
  browserTick: 0,
  toasts: [],
  agentStep: null,
  runProgress: null,
  undoWrite: null,
  chatFind: '',
  checkpoints: [],
  showArchived: false,
  swarm: null,
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
  appendToLastReasoning: (content) => set((s) => {
    if (s.messages.length === 0) return s
    const last = s.messages[s.messages.length - 1]
    if (last.role !== 'assistant') return s
    const updated = { ...last, reasoning: (last.reasoning || '') + content }
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
  setStreaming: (v) => set(v
    ? { isStreaming: true }
    : { isStreaming: false, runProgress: null, agentStep: null }),
  setModel: (model, provider) => set({ currentModel: model, currentProvider: provider }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleBrowser: () => set((s) => ({ browserOpen: !s.browserOpen, browserFullscreen: s.browserOpen ? false : s.browserFullscreen })),
  openInBrowser: (url) => set((s) => ({
    browserOpen: true,
    browserUrl: url,
    browserTick: s.browserUrl === url ? s.browserTick + 1 : s.browserTick,
  })),
  setBrowserUrl: (browserUrl) => set({ browserUrl }),
  setBrowserFullscreen: (browserFullscreen) => set({ browserFullscreen }),
  setSessions: (sessions) => set({ sessions }),
  setConfig: (config) => set({ config }),
  setFileTree: (tree) => set({ fileTree: tree }),
  clearMessages: () => set({ messages: [], checkpoints: [], undoWrite: null, agentStep: null, runProgress: null, swarm: null }),
  setCurrentSessionId: (id) => {
    rememberSessionId(id)
    set({ currentSessionId: id, checkpoints: [], undoWrite: null, swarm: null, runProgress: null })
  },
  loadSessionMessages: (msgs) => set({
    messages: msgs.map((m, i) => ({
      id: `loaded-${Date.now()}-${i}`,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      reasoning: m.reasoning,
      timestamp: Date.now() - (msgs.length - i) * 1000,
      toolCalls: (m as any).toolCalls,
      stats: (m as any).stats,
    })),
    swarm: null,
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
  upsertOpenFile: (file) => set((s) => {
    const i = s.openFiles.findIndex((f) => f.path === file.path)
    const openFiles = i >= 0
      ? s.openFiles.map((f, idx) => (idx === i ? { ...f, ...file } : f))
      : [...s.openFiles, file]
    return { openFiles, activeFilePath: file.path }
  }),
  closeFile: (path) => set((s) => {
    const openFiles = s.openFiles.filter((f) => f.path !== path)
    const activeFilePath = s.activeFilePath === path
      ? (openFiles[openFiles.length - 1]?.path || null)
      : s.activeFilePath
    return { openFiles, activeFilePath }
  }),
  setActiveFile: (activeFilePath) => set({ activeFilePath }),
  setPendingWorkspace: (pendingWorkspace) => set({ pendingWorkspace }),
  setQueuedMessage: (queuedMessage) => set({ queuedMessage }),
  setPreviewOffer: (previewOffer) => set({ previewOffer }),
  bumpBrowser: () => set((s) => ({ browserTick: s.browserTick + 1 })),
  pushToast: (toast) => set((s) => ({
    toasts: [...s.toasts.slice(-4), { id: toast.id || `${Date.now()}-${s.toasts.length}`, kind: toast.kind, text: toast.text }],
  })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setAgentStep: (agentStep) => set({ agentStep }),
  setRunProgress: (progress) => set((s) => {
    if (!progress) return { runProgress: null }
    return {
      runProgress: {
        ...progress,
        startedAt: s.runProgress?.startedAt || Date.now(),
      },
    }
  }),
  setUndoWrite: (undoWrite) => set({ undoWrite }),
  setChatFind: (chatFind) => set({ chatFind }),
  addCheckpoint: (label) => set((s) => {
    if (s.messages.length === 0) return s
    const item: Checkpoint = {
      id: `cp-${Date.now()}`,
      label: label || `Before turn ${s.messages.filter((m) => m.role === 'user').length}`,
      at: Date.now(),
      messages: s.messages.map((m) => ({ ...m })),
    }
    return { checkpoints: [...s.checkpoints.slice(-7), item] }
  }),
  restoreCheckpoint: (id) => set((s) => {
    const hit = s.checkpoints.find((c) => c.id === id)
    if (!hit) return s
    return { messages: hit.messages.map((m) => ({ ...m })), agentStep: null, runProgress: null }
  }),
  setShowArchived: (showArchived) => set({ showArchived }),
  startSwarm: (payload) => set((s) => {
    const workers = payload.workers.map((w) => ({
      id: w.id,
      role: w.role,
      task: w.task,
      content: '',
      status: 'running' as const,
    }))
    const ids = workers.map((w) => w.id).join(',')
    if (s.swarm && s.swarm.workers.map((w) => w.id).join(',') === ids) {
      return {
        swarm: {
          ...s.swarm,
          goal: payload.goal || s.swarm.goal,
          active: true,
          workers: s.swarm.workers.map((w, i) => ({
            ...w,
            role: workers[i]?.role || w.role,
            task: workers[i]?.task || w.task,
            status: w.status === 'done' || w.status === 'error' ? w.status : 'running',
          })),
        },
      }
    }
    return {
      swarm: {
        goal: payload.goal || '',
        active: true,
        workers,
      },
    }
  }),
  appendSwarmToken: (id, content) => set((s) => {
    if (!s.swarm) return s
    return {
      swarm: {
        ...s.swarm,
        workers: s.swarm.workers.map((w) => (
          w.id === id
            ? { ...w, content: w.content + content, status: w.status === 'pending' ? 'running' : w.status }
            : w
        )),
      },
    }
  }),
  setSwarmWorker: (id, updates) => set((s) => {
    if (!s.swarm) return s
    return {
      swarm: {
        ...s.swarm,
        workers: s.swarm.workers.map((w) => (w.id === id ? { ...w, ...updates } : w)),
      },
    }
  }),
  endSwarm: () => set((s) => {
    if (!s.swarm) return s
    return {
      swarm: {
        ...s.swarm,
        active: false,
        workers: s.swarm.workers.map((w) => (
          w.status === 'running' || w.status === 'pending' ? { ...w, status: 'done' } : w
        )),
      },
    }
  }),
  clearSwarm: () => set({ swarm: null }),
}))
