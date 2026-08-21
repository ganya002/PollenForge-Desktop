import { useState, useEffect, useRef, KeyboardEvent } from 'react'

interface CommandMenuProps {
  filter: string
  onSelect: (command: string) => void
  onClose: () => void
}

const COMMANDS = [
  { name: '/help', description: 'Show help and commands' },
  { name: '/clear', description: 'Clear conversation' },
  { name: '/compact', description: 'Summarize conversation' },
  { name: '/cost', description: 'Show token usage' },
  { name: '/model', description: 'Switch model' },
  { name: '/search', description: 'Search files' },
  { name: '/file', description: 'Read a file' },
  { name: '/folder', description: 'Browse folder' },
  { name: '/commit', description: 'Create commit' },
  { name: '/diff', description: 'Show diff' },
]

export default function CommandMenu({ filter, onSelect, onClose }: CommandMenuProps) {
  const [selected, setSelected] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = COMMANDS.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase())
  )

  useEffect(() => {
    setSelected(0)
  }, [filter])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => filtered.length ? (s + 1) % filtered.length : 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => filtered.length ? (s - 1 + filtered.length) % filtered.length : 0)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selected]) {
          e.preventDefault()
          onSelect(filtered[selected].name)
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler as any)
    return () => window.removeEventListener('keydown', handler as any)
  }, [filtered, selected, onSelect, onClose])

  if (filtered.length === 0) return null

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 right-0 mb-2 bg-surface-2 border border-border rounded-lg shadow-xl overflow-hidden z-50"
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd.name)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-smooth ${
            i === selected
              ? 'bg-accent-muted text-accent'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
          }`}
        >
          <span className="text-sm font-mono font-medium">{cmd.name}</span>
          <span className="text-xs text-text-muted">{cmd.description}</span>
        </button>
      ))}
    </div>
  )
}
