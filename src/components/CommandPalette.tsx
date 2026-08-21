import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/store'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNewChat: () => void
}

const COMMANDS = [
  { id: 'new-chat', label: 'New Chat', description: 'Start a fresh conversation', shortcut: 'Cmd+N', icon: 'plus' },
  { id: 'clear-chat', label: 'Clear Chat', description: 'Clear all messages', shortcut: 'Cmd+K', icon: 'trash' },
  { id: 'toggle-sidebar', label: 'Toggle Sidebar', description: 'Show/hide the sidebar', shortcut: 'Cmd+B', icon: 'sidebar' },
  { id: 'settings', label: 'Settings', description: 'Open settings', shortcut: 'Cmd+,', icon: 'settings' },
  { id: 'check-updates', label: 'Check for Updates', description: 'See versions and install updates', icon: 'download' },
  { id: 'export-chat', label: 'Export Chat', description: 'Save conversation as markdown', icon: 'export' },
  { id: 'copy-last', label: 'Copy Last Response', description: 'Copy the last assistant message', icon: 'copy' },
  { id: 'run-command', label: 'Run Command', description: 'Execute a shell command', icon: 'terminal' },
]

const ICONS: Record<string, JSX.Element> = {
  plus: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5 4V3h4v1M4 4v7h6V4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  sidebar: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1" /><path d="M6 2v10" stroke="currentColor" strokeWidth="1" /></svg>,
  settings: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1" /><path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>,
  download: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4.5 6.5L7 9l2.5-2.5M3 11.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  export: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 6l3 3 3-3M3 11h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1" /><path d="M3 10V3h7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>,
  terminal: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1" /><path d="M4 6l2 1.5L4 9M7.5 9h2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>,
}

export default function CommandPalette({ open, onClose, onNewChat }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [query])

  const execute = (id: string) => {
    onClose()
    switch (id) {
      case 'new-chat':
        onNewChat()
        break
      case 'clear-chat':
        useStore.getState().clearMessages()
        break
      case 'toggle-sidebar':
        useStore.getState().toggleSidebar()
        break
      case 'settings':
        document.dispatchEvent(new CustomEvent('open-settings'))
        break
      case 'check-updates':
        document.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'updates' } }))
        window.api?.updates?.check?.().catch(() => {})
        break
      case 'export-chat': {
        const msgs = useStore.getState().messages
        const md = msgs
          .map((m: { role: string; content: string }) => `### ${m.role === 'user' ? 'You' : 'Assistant'}\n\n${m.content}`)
          .join('\n\n---\n\n')
        const blob = new Blob([md], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `pollenforge-chat-${Date.now()}.md`
        a.click()
        URL.revokeObjectURL(url)
        break
      }
      case 'copy-last': {
        const msgs = useStore.getState().messages
        const last = [...msgs].reverse().find((m) => m.role === 'assistant' && m.content)
        if (last) navigator.clipboard.writeText(last.content)
        break
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selected]) execute(filtered[selected].id)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md bg-surface-1 border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-text-muted shrink-0">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <kbd className="text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">esc</kbd>
            </div>

            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-4 py-3 text-sm text-text-muted">No commands found</div>
              )}
              {filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={() => execute(cmd.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-smooth ${
                    i === selected
                      ? 'bg-accent-muted text-accent'
                      : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  }`}
                >
                  <span className="shrink-0">{ICONS[cmd.icon]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{cmd.label}</div>
                    <div className="text-[10px] text-text-muted">{cmd.description}</div>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border shrink-0">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
