import { useState, useEffect, useCallback } from 'react'

import { useStore } from './store/store'
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

export default function App() {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const { messages, isStreaming, sendMessage, retryLastMessage, scrollRef } = useChat()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('providers')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
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
    fetch(`${API}/files/list?path=.`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && !data.error && data.entries) {
          useStore.getState().setFileTree(
            data.entries.map((item: Record<string, unknown>) => ({
              name: item.name as string,
              path: (item.path as string) || (item.name as string),
              isDirectory: (item.is_dir as boolean) ?? (item.isDirectory as boolean) ?? false,
              size: (item.size as number | null) ?? null,
              modified: (item.modified as number) ?? 0,
              git_status: item.git_status as string | undefined,
            }))
          )
        }
      })
      .catch(() => {})

    fetch(`${API}/sessions`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (Array.isArray(data)) useStore.getState().setSessions(data)
      })
      .catch(() => {})

    fetch(`${API}/config`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.providers) useStore.getState().setConfig(data)
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
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
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSidebar, handleNewChat])

  return (
    <div className="flex h-full bg-surface-0">
      <Sidebar onSettings={() => openSettings('providers')} />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Title bar */}
        <div className="drag-region flex items-center h-10 pl-20 pr-4 bg-surface-1 border-b border-border shrink-0">
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

          <span className="flex-1 text-xs text-text-muted font-medium select-none">
            Nexum
          </span>

          <div className="no-drag flex items-center gap-1">
            <UpdateBadge variant="icon" onClick={() => openSettings('updates')} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 min-h-0">
          <ChatArea messages={messages} scrollRef={scrollRef} onRetry={retryLastMessage} />
          <ApprovalPrompt />
          <InputBar onSend={sendMessage} isStreaming={isStreaming} />
        </div>

        {/* Status bar */}
        <StatusBar onOpenUpdates={() => openSettings('updates')} />
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewChat={handleNewChat} />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
