import { motion, AnimatePresence } from 'framer-motion'
import { Ref } from 'react'
import { Message as MessageType } from '../../store/store'
import Message from './Message'

interface ChatAreaProps {
  messages: MessageType[]
  scrollRef: Ref<HTMLDivElement>
  onRetry?: () => void
}

function WelcomeScreen() {
  const suggestions = [
    { icon: 'folder', text: 'What\'s in my Downloads folder?' },
    { icon: 'chip', text: 'Check my RAM usage' },
    { icon: 'window', text: 'Open VS Code' },
    { icon: 'code', text: 'Create a todo app' },
  ]

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent-muted flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-accent">
            <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M4 10l12 6m0 0l12-6m-12 6v12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Nexum</h1>
        <p className="text-text-secondary text-sm leading-relaxed mb-6">
          AI coding assistant with full computer access. I can read, write, and execute anything on your machine.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-6">
          {suggestions.map((s) => (
            <button
              key={s.text}
              className="text-left px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-text-secondary hover:text-text-primary transition-smooth border border-border hover:border-border-hover flex items-center gap-2"
              onClick={() => {
                document.dispatchEvent(new CustomEvent('send-message', { detail: s.text }))
              }}
            >
              <span className="shrink-0 text-text-muted">
                {s.icon === 'folder' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5A1.5 1.5 0 013 2h4l2 2h5a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0114 14H3a1.5 1.5 0 01-1.5-1.5v-9z" fill="currentColor" /></svg>}
                {s.icon === 'chip' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M6 3v2M10 3v2M6 11v2M10 11v2M3 6h2M3 10h2M11 6h2M11 10h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>}
                {s.icon === 'window' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M2 5.5h12" stroke="currentColor" strokeWidth="1.1" /></svg>}
                {s.icon === 'code' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3L3 8l3 5M10 3l3 5-3 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
              {s.text}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 text-xs text-text-muted">
          <div className="flex items-center gap-2 justify-center">
            <kbd className="px-1.5 py-0.5 bg-surface-2 rounded border border-border font-mono">Enter</kbd>
            <span>send</span>
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 bg-surface-2 rounded border border-border font-mono">Shift+Enter</kbd>
            <span>newline</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <kbd className="px-1.5 py-0.5 bg-surface-2 rounded border border-border font-mono">/</kbd>
            <span>commands</span>
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 bg-surface-2 rounded border border-border font-mono">@</kbd>
            <span>files</span>
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 bg-surface-2 rounded border border-border font-mono">Cmd+K</kbd>
            <span>palette</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatArea({ messages, scrollRef, onRetry }: ChatAreaProps) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
      {messages.length === 0 ? (
        <WelcomeScreen />
      ) : (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Message message={msg} onRetry={onRetry} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
