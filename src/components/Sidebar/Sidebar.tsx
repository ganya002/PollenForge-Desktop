import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/store'
import SessionList from './SessionList'
import FileTree from './FileTree'
import ModelPicker from './ModelPicker'
import WorktreeIndicator from './WorktreeIndicator'
import TaskPanel from './TaskPanel'

interface SidebarProps {
  onSettings?: () => void
  overlayTitlebar?: boolean
}

const MIN_W = 200
const MAX_W = 480
const DEFAULT_W = 280
const WIDTH_KEY = 'nx-sidebar-width'

function readSavedWidth(): number {
  try {
    const saved = localStorage.getItem(WIDTH_KEY) || localStorage.getItem('pf-sidebar-width')
    const n = saved ? parseInt(saved, 10) : DEFAULT_W
    return Math.min(MAX_W, Math.max(MIN_W, n))
  } catch {
    return DEFAULT_W
  }
}

export default function Sidebar({ onSettings, overlayTitlebar = true }: SidebarProps) {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const [width, setWidth] = useState(readSavedWidth)
  const [isDragging, setIsDragging] = useState(false)
  const widthRef = useRef(width)
  const asideRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isDragging) return

    const onMove = (e: PointerEvent) => {
      const next = Math.min(MAX_W, Math.max(MIN_W, e.clientX))
      widthRef.current = next
      if (asideRef.current) asideRef.current.style.width = `${next}px`
    }

    const onUp = () => {
      setIsDragging(false)
      const finalWidth = widthRef.current
      setWidth(finalWidth)
      try {
        localStorage.setItem(WIDTH_KEY, String(finalWidth))
      } catch {
        /* ignore */
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging])

  return (
    <AnimatePresence initial={false}>
      {sidebarOpen && (
        <motion.aside
          ref={asideRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          style={{ width }}
          className="h-full bg-surface-1 border-r border-border flex flex-col overflow-hidden shrink-0 relative"
        >
          <div className={`flex flex-col h-full ${overlayTitlebar ? 'pt-10' : 'pt-0'}`} style={{ width: '100%' }}>
            <ModelPicker />
            <SessionList />
            <WorktreeIndicator />
            <div className="flex-1 overflow-y-auto min-h-0">
              <FileTree />
            </div>
            <TaskPanel />
            {onSettings && (
              <div className="h-10 shrink-0 border-t border-border px-2 flex items-center">
                <button
                  onClick={onSettings}
                  className="w-full h-8 flex items-center gap-2 px-2 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-smooth text-[13px]"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <circle cx="7" cy="7" r="2" />
                    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M11.2 2.8l-1.4 1.4M4.2 9.8l-1.4 1.4" />
                  </svg>
                  <span>Settings</span>
                  <span className="ml-auto text-[11px] text-text-muted">⌘,</span>
                </button>
              </div>
            )}
          </div>
          <div
            onPointerDown={(e) => {
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              setIsDragging(true)
            }}
            className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize no-drag ${
              isDragging ? 'bg-white/15' : 'hover:bg-white/10'
            }`}
            style={{ touchAction: 'none' }}
            aria-label="Resize sidebar"
          >
            <div className="absolute inset-y-0 right-0 w-px bg-border" />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
