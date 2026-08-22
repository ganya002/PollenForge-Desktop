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
import { useAvailableUpdate } from './hooks/useAvailableUpdate'
import { mergeFetchedConfig, mergeProviderModels } from './lib/appConfig'
import { refreshSessions } from './lib/sessions'
import FilePanel from './components/Files/FilePanel'
import BrowserPanel from './components/Browser/BrowserPanel'

export default function App() {
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const toggleBrowser = useStore((s) => s.toggleBrowser)
  const browserOpen = useStore((s) => s.browserOpen)
  const { messages, isStreaming, sendMessage, stopGeneration, editAndResend, compactChat, retryLastMessage, scrollRef } = useChat()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('providers')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const nativeFrame = window.api?.app?.nativeFrame === true
  const currentSession = useStore((s) => s.sessions.find((x) => x.id === s.currentSessionId))
  const hasOpenFiles = useStore((s) => s.openFiles.length > 0)
  useAvailableUpdate()

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

    fetch(`${API}/config`)
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
      if (e.key === 'Escape' && useStore.getState().isStreaming) {
        e.preventDefault()
        stopGeneration()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSidebar, toggleBrowser, handleNewChat, stopGeneration])

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
        <StatusBar onOpenUpdates={() => openSettings('updates')} />
      </div>

      <BrowserPanel />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewChat={handleNewChat} onCompact={compactChat} />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
