import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/store'
import SessionList from './SessionList'
import FileTree from './FileTree'
import ModelPicker from './ModelPicker'
import WorktreeIndicator from './WorktreeIndicator'
import TaskPanel from './TaskPanel'

interface SidebarProps {
  onSettings?: () => void
}

export default function Sidebar({ onSettings }: SidebarProps) {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('pf-sidebar-width')
      const n = saved ? parseInt(saved, 10) : 280
      return Math.min(480, Math.max(200, n))
    } catch { return 280 }
  })
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const newWidth = Math.min(480, Math.max(200, e.clientX))
      setWidth(newWidth)
    }
    const onUp = () => {
      setIsDragging(false)
      try { localStorage.setItem('pf-sidebar-width', String(width)) } catch {}
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, width])

  useEffect(() => {
    try { localStorage.setItem('pf-sidebar-width', String(width)) } catch {}
  }, [width])

  return (
    <AnimatePresence initial={false}>
      {sidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full bg-surface-1 border-r border-border flex flex-col overflow-hidden shrink-0 relative"
        >
          <div className="flex flex-col h-full pt-[44px]" style={{ width: `${width}px` }}>
            <ModelPicker />
            <SessionList />
            <WorktreeIndicator />
            <div className="flex-1 overflow-y-auto min-h-0">
              <FileTree />
            </div>
            <TaskPanel />
            {onSettings && (
              <div className="p-3 border-t border-border">
                <button
                  onClick={onSettings}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-smooth text-xs"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <circle cx="7" cy="7" r="2" />
                    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M11.2 2.8l-1.4 1.4M4.2 9.8l-1.4 1.4" />
                  </svg>
                  Settings
                  <span className="ml-auto text-[10px] text-text-muted/60">Cmd+,</span>
                </button>
              </div>
            )}
          </div>
          {/* Resize handle */}
          <div
            onMouseDown={() => setIsDragging(true)}
            className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-white/10 transition-colors no-drag ${isDragging ? 'bg-white/10' : ''}`}
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
