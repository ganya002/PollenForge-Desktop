import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useStore } from './store/store'
import { easeOut, slidePanel } from './lib/motion'
import { useChat } from './hooks/useChat'
import Sidebar from './components/Sidebar/Sidebar'
import ChatArea from './components/Chat/ChatArea'
import InputBar from './components/Input/InputBar'
import StatusBar from './components/StatusBar'
import ApprovalPrompt from './components/Chat/ApprovalPrompt'
import SettingsModal from './components/Settings/SettingsModal'
import type { SettingsTab } from './components/Settings/SettingsModal'
import CommandPalette from './components/CommandPalette'
import KeyboardHelp from './components/KeyboardHelp'
import UpdateBadge from './components/UpdateBadge'
import ToastHost from './components/ToastHost'
import { useAvailableUpdate } from './hooks/useAvailableUpdate'
import { mergeFetchedConfig, mergeProviderModels, persistConfig } from './lib/appConfig'
import { applyTheme, normalizeTheme } from './lib/qol'
import { refreshSessions } from './lib/sessions'
import { writeWorkspaceFile } from './lib/workspace'
import FilePanel from './components/Files/FilePanel'
import BrowserPanel from './components/Browser/BrowserPanel'

export default function App() {
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const toggleBrowser = useStore((s) => s.toggleBrowser)
  const browserOpen = useStore((s) => s.browserOpen)
  const { messages, isStreaming, sendMessage, continueChat, stopGeneration, editAndResend, compactChat, retryLastMessage, reconnect, scrollRef } = useChat()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('providers')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const nativeFrame = window.api?.app?.nativeFrame === true
  const currentSession = useStore((s) => s.sessions.find((x) => x.id === s.currentSessionId))
  const hasOpenFiles = useStore((s) => s.openFiles.length > 0)
  const wsConnected = useStore((s) => s.wsConnected)
  const agentMode = useStore((s) => s.config.agent_mode) || 'agent'
  const theme = useStore((s) => s.config.theme)
  const undoWrite = useStore((s) => s.undoWrite)
  const checkpoints = useStore((s) => s.checkpoints)
  const chatFind = useStore((s) => s.chatFind)
  useAvailableUpdate()

  useEffect(() => {
    try {
      applyTheme(normalizeTheme(localStorage.getItem('nx-theme') || theme))
    } catch {
      applyTheme(normalizeTheme(theme))
    }
  }, [])

  useEffect(() => {
    const next = normalizeTheme(theme)
    applyTheme(next)
    try {
      localStorage.setItem('nx-theme', next)
    } catch {
      /* ignore */
    }
  }, [theme])

  const handleNewChat = useCallback(() => {
    useStore.getState().clearMessages()
    useStore.getState().setCurrentSessionId(null)
  }, [])

  const openSettings = useCallback((tab: SettingsTab = 'providers') => {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }, [])

  useEffect(() => {
    const API = 'http://127.0.0.1:8765'
    void refreshSessions()

    const loadLocal = window.api?.config?.get
      ? window.api.config.get()
          .then((result) => {
            if (result?.success && result.config && Object.keys(result.config).length > 0) {
              const state = useStore.getState()
              state.setConfig(mergeFetchedConfig(state.config, result.config))
            }
          })
          .catch(() => {})
      : Promise.resolve()

    void loadLocal
      .then(() => fetch(`${API}/config`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.providers) {
          const state = useStore.getState()
          state.setConfig(mergeFetchedConfig(state.config, data))
        }
      })
      .catch(() => {})
      .then(() => fetch(`${API}/providers`))
      .then((r) => (r && r.ok ? r.json() : null))
      .then((list) => {
        if (!Array.isArray(list)) return
        const state = useStore.getState()
        state.setConfig(mergeProviderModels(state.config, list))
      })
      .catch(() => {})

    // Load worktrees in background
    fetch(`${API}/tools/worktree_list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '.' })
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.worktrees) useStore.getState().setWorktrees(data.worktrees)
    }).catch(() => {})

    const openSettingsEvent = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: SettingsTab }>).detail?.tab
      openSettings(tab || 'providers')
    }
    document.addEventListener('open-settings', openSettingsEvent)
    return () => document.removeEventListener('open-settings', openSettingsEvent)
  }, [openSettings])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (e.shiftKey) {
          useStore.getState().clearMessages()
        } else {
          setPaletteOpen(true)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        if (e.shiftKey) toggleBrowser()
        else toggleSidebar()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
        setSettingsTab('providers')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setHelpOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        handleNewChat()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFindOpen(true)
      }
      if (e.key === 'Escape') {
        if (findOpen) {
          e.preventDefault()
          setFindOpen(false)
          useStore.getState().setChatFind('')
          return
        }
        if (useStore.getState().isStreaming) {
          e.preventDefault()
          stopGeneration()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSidebar, toggleBrowser, handleNewChat, stopGeneration, findOpen])

  useEffect(() => {
    const openFind = () => setFindOpen(true)
    document.addEventListener('open-find', openFind)
    return () => document.removeEventListener('open-find', openFind)
  }, [])

  const setAgentMode = useCallback((mode: 'ask' | 'agent') => {
    const cfg = useStore.getState().config
    const next = { ...cfg, agent_mode: mode }
    useStore.getState().setConfig(next)
    persistConfig(next)
  }, [])

  const undoLastWrite = useCallback(async () => {
    const undo = useStore.getState().undoWrite
    if (!undo) return
    try {
      await writeWorkspaceFile(undo.path, undo.content, undo.root)
      useStore.getState().setUndoWrite(null)
      useStore.getState().pushToast({ kind: 'info', text: `Restored ${undo.path}` })
    } catch {
      useStore.getState().pushToast({ kind: 'error', text: 'Could not undo that write.' })
    }
  }, [])

  return (
    <div className="flex h-full bg-surface-0">
      <Sidebar onSettings={() => openSettings('providers')} overlayTitlebar={!nativeFrame} />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Title bar */}
        <div
          className={`flex items-center h-10 bg-surface-1 border-b border-border shrink-0 px-3 ${
            nativeFrame ? '' : 'drag-region'
          }`}
          style={
            nativeFrame
              ? undefined
              : {
                  paddingLeft: 'max(12px, env(titlebar-area-x, 80px))',
                  paddingRight: 'max(12px, calc(100% - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100%)))',
                  height: 'env(titlebar-area-height, 40px)',
                }
          }
        >
          <button
            onClick={toggleSidebar}
            className="no-drag p-1.5 rounded hover:bg-surface-2 transition-smooth text-text-secondary hover:text-text-primary"
            aria-label="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="3" width="12" height="1.5" rx="0.75" />
              <rect x="2" y="7" width="8" height="1.5" rx="0.75" />
              <rect x="2" y="11" width="12" height="1.5" rx="0.75" />
            </svg>
          </button>

          <span className="flex-1 text-[13px] text-text-secondary font-medium select-none truncate px-2">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentSession?.id || 'new'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: easeOut }}
                className="block truncate"
              >
                {currentSession?.name || 'New chat'}
              </motion.span>
            </AnimatePresence>
          </span>

          <div className="no-drag flex items-center gap-1">
            <div className="flex items-center rounded-md border border-border overflow-hidden mr-1">
              <button
                onClick={() => setAgentMode('ask')}
                className={`h-6 px-2 text-[11px] ${agentMode === 'ask' ? 'bg-surface-3 text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                title="Ask — inspect only, no writes"
              >
                Ask
              </button>
              <button
                onClick={() => setAgentMode('agent')}
                className={`h-6 px-2 text-[11px] ${agentMode === 'agent' ? 'bg-surface-3 text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                title="Agent — can write files and run commands"
              >
                Agent
              </button>
            </div>
            {messages.length > 0 && !isStreaming && (
              <button
                onClick={() => continueChat()}
                className="h-6 px-2 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-surface-2"
                title="Continue this task"
              >
                Continue
              </button>
            )}
            {undoWrite && (
              <button
                onClick={() => void undoLastWrite()}
                className="h-6 px-2 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-surface-2"
                title={`Undo write to ${undoWrite.path}`}
              >
                Undo
              </button>
            )}
            {checkpoints.length > 0 && (
              <button
                onClick={() => {
                  const last = checkpoints[checkpoints.length - 1]
                  if (last) useStore.getState().restoreCheckpoint(last.id)
                }}
                className="h-6 px-2 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-surface-2"
                title={checkpoints[checkpoints.length - 1]?.label || 'Restore checkpoint'}
              >
                Restore
              </button>
            )}
            <UpdateBadge variant="icon" onClick={() => openSettings('updates')} />
            <button
              onClick={toggleBrowser}
              className={`p-1.5 rounded hover:bg-surface-2 transition-smooth ${
                browserOpen ? 'text-text-primary bg-surface-2' : 'text-text-secondary hover:text-text-primary'
              }`}
              aria-label="Toggle browser"
              title="Browser (Ctrl+Shift+B)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M9.5 3v10M2 6.5h7.5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0">
            {!wsConnected && (
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-danger/10 border-b border-danger/20 text-[12px] text-text-secondary shrink-0">
                <span>Backend is disconnected. Chat will retry automatically.</span>
                <button
                  onClick={() => reconnect()}
                  className="h-6 px-2 rounded-md border border-border bg-surface-2 text-text-primary hover:bg-surface-3"
                >
                  Retry
                </button>
              </div>
            )}
            {findOpen && (
              <div className="flex items-center gap-2 px-3 h-9 border-b border-border bg-surface-1 shrink-0">
                <input
                  autoFocus
                  value={chatFind}
                  onChange={(e) => useStore.getState().setChatFind(e.target.value)}
                  placeholder="Find in this thread"
                  className="flex-1 h-7 px-2 rounded-md bg-surface-2 border border-border text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <button
                  onClick={() => {
                    setFindOpen(false)
                    useStore.getState().setChatFind('')
                  }}
                  className="h-6 px-2 rounded-md text-[11px] text-text-muted hover:text-text-primary"
                >
                  Close
                </button>
              </div>
            )}
            <ChatArea messages={messages} scrollRef={scrollRef} onRetry={retryLastMessage} onEdit={editAndResend} />
            <ApprovalPrompt />
            <InputBar onSend={sendMessage} onStop={stopGeneration} onCompact={compactChat} isStreaming={isStreaming} />
          </div>
          <AnimatePresence>
            {hasOpenFiles && (
              <motion.div
                key="file-panel"
                initial={slidePanel.initial}
                animate={slidePanel.animate}
                exit={slidePanel.exit}
                transition={slidePanel.transition}
                className="h-full min-h-0"
              >
                <FilePanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status bar */}
        <StatusBar onOpenUpdates={() => openSettings('updates')} onRetry={reconnect} />
      </div>

      <BrowserPanel />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewChat={handleNewChat} onCompact={compactChat} onContinue={continueChat} />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ToastHost />
    </div>
  )
}
