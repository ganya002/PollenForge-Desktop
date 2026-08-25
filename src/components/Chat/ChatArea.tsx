import { motion, AnimatePresence } from 'framer-motion'
import { Ref, UIEventHandler, WheelEventHandler, useEffect } from 'react'
import { Message as MessageType, useStore } from '../../store/store'
import { easeSnappy, fadeUpSnappy, staggerContainer, staggerItem, snappySpring } from '../../lib/motion'
import { messageMatchesFind } from '../../lib/qol'
import Message from './Message'

interface ChatAreaProps {
  messages: MessageType[]
  scrollRef: Ref<HTMLDivElement>
  onRetry?: () => void
  onEdit?: (userId: string, content: string) => void
  onScroll?: UIEventHandler<HTMLDivElement>
  onWheel?: WheelEventHandler<HTMLDivElement>
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
        className="welcome-col text-center my-auto w-full min-w-0 px-1"
        initial={{ opacity: 0, y: 8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={snappySpring}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...snappySpring, delay: 0.02 }}
          className="w-11 h-11 mx-auto mb-4 rounded-xl bg-surface-2 border border-border flex items-center justify-center"
        >
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" className="text-text-secondary">
            <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M4 10l12 6m0 0l12-6m-12 6v12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <h1 className="text-[26px] font-semibold tracking-tight text-text-primary mb-1.5">Nexum Beta</h1>
        <p className="text-text-muted text-[13px] leading-relaxed mb-6 max-w-sm mx-auto">
          Local coding assistant. Read, write, and run things on this machine.
        </p>

        <motion.div
          className="grid grid-cols-1 min-[20rem]:grid-cols-2 gap-2 text-left w-full"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {suggestions.map((s) => (
            <motion.button
              key={s.text}
              variants={staggerItem}
              whileHover={{ y: -1, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="h-10 min-w-0 px-3 bg-surface-1 hover:bg-surface-2 rounded-lg text-[13px] leading-4 text-text-secondary hover:text-text-primary border border-border hover:border-border-hover flex items-center gap-2 overflow-hidden transition-snappy hover:shadow-md"
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
              <span className="truncate min-w-0">{s.text}</span>
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

export default function ChatArea({ messages, scrollRef, onRetry, onEdit, onScroll, onWheel }: ChatAreaProps) {
  const empty = messages.length === 0
  const chatFind = useStore((s) => s.chatFind)

  useEffect(() => {
    if (!chatFind.trim()) return
    const first = messages.find((m) => (
      messageMatchesFind(m.content, chatFind) || messageMatchesFind(m.reasoning || '', chatFind)
    ))
    if (!first) return
    const el = document.getElementById(`msg-${first.id}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [chatFind, messages])

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      onWheel={onWheel}
      className={`flex-1 min-h-[7rem] min-w-0 bg-surface-0 ${empty ? 'flex flex-col' : 'overflow-y-auto'}`}
    >
      {empty ? (
        <WelcomeScreen />
      ) : (
        <div className="composer-col px-5 py-8">
          <AnimatePresence initial={false} mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                layout
                initial={fadeUpSnappy.initial}
                animate={fadeUpSnappy.animate}
                exit={fadeUpSnappy.exit}
                transition={snappySpring}
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
