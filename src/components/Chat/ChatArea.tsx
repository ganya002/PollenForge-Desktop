import { motion, AnimatePresence } from 'framer-motion'
import { Ref, useEffect } from 'react'
import { Message as MessageType, useStore } from '../../store/store'
import { easeOut, fadeUp } from '../../lib/motion'
import { messageMatchesFind } from '../../lib/qol'
import Message from './Message'

interface ChatAreaProps {
  messages: MessageType[]
  scrollRef: Ref<HTMLDivElement>
  onRetry?: () => void
  onEdit?: (userId: string, content: string) => void
}

function WelcomeScreen() {
  const suggestions = [
    { icon: 'folder', text: "What's in my Downloads folder?" },
    { icon: 'chip', text: 'Check my RAM usage' },
    { icon: 'window', text: 'Open VS Code' },
    { icon: 'code', text: 'Create a todo app' },
  ]

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8 min-h-0 overflow-y-auto">
      <motion.div
        className="welcome-col text-center my-auto"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeOut }}
      >
        <div className="w-11 h-11 mx-auto mb-4 rounded-xl bg-surface-2 border border-border flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" className="text-text-secondary">
            <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M4 10l12 6m0 0l12-6m-12 6v12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight text-text-primary mb-1.5">Nexum</h1>
        <p className="text-text-muted text-[13px] leading-relaxed mb-6 max-w-sm mx-auto">
          Local coding assistant. Read, write, and run things on this machine.
        </p>

        <div className="grid grid-cols-2 gap-2 text-left">
          {suggestions.map((s, i) => (
            <motion.button
              key={s.text}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.08 + i * 0.05, ease: easeOut }}
              className="h-11 px-3 bg-surface-1 hover:bg-surface-2 rounded-lg text-[13px] text-text-secondary hover:text-text-primary transition-smooth border border-border hover:border-border-hover flex items-center gap-2.5"
              onClick={() => {
                document.dispatchEvent(new CustomEvent('send-message', { detail: s.text }))
              }}
            >
              <span className={`shrink-0 w-4 h-4 inline-flex items-center justify-center ${
                s.icon === 'folder' ? 'text-sky-400' : s.icon === 'chip' ? 'text-emerald-400' : s.icon === 'window' ? 'text-amber-400' : 'text-violet-400'
              }`}>
                {s.icon === 'folder' && <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5A1.5 1.5 0 013 2h4l2 2h5a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0114 14H3a1.5 1.5 0 01-1.5-1.5v-9z" fill="currentColor" /></svg>}
                {s.icon === 'chip' && <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M6 3v2M10 3v2M6 11v2M10 11v2M3 6h2M3 10h2M11 6h2M11 10h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>}
                {s.icon === 'window' && <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M2 5.5h12" stroke="currentColor" strokeWidth="1.1" /></svg>}
                {s.icon === 'code' && <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M6 3L3 8l3 5M10 3l3 5-3 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
              {s.text}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default function ChatArea({ messages, scrollRef, onRetry, onEdit }: ChatAreaProps) {
  const empty = messages.length === 0
  const chatFind = useStore((s) => s.chatFind)

  useEffect(() => {
    if (!chatFind.trim()) return
    const first = messages.find((m) => messageMatchesFind(m.content, chatFind))
    if (!first) return
    const el = document.getElementById(`msg-${first.id}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [chatFind, messages])

  return (
    <div
      ref={scrollRef}
      className={`flex-1 min-h-0 bg-surface-0 ${empty ? 'flex flex-col' : 'overflow-y-auto'}`}
    >
      {empty ? (
        <WelcomeScreen />
      ) : (
        <div className="composer-col px-4 py-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={fadeUp.initial}
                animate={fadeUp.animate}
                transition={fadeUp.transition}
              >
                <Message
                  message={msg}
                  onRetry={onRetry}
                  onEdit={msg.role === 'user' && onEdit ? (content) => onEdit(msg.id, content) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
