import { useState, useEffect, useRef } from 'react'
import { useStore, FileEntry } from '../../store/store'

interface FileMentionMenuProps {
  query: string
  onSelect: (path: string) => void
  onClose: () => void
}

type MentionItem = { name: string; path: string; isDirectory: boolean; isWeb?: boolean }

function flattenFiles(entries: FileEntry[]): MentionItem[] {
  const result: MentionItem[] = []
  for (const e of entries) {
    result.push({ name: e.name, path: e.path, isDirectory: e.isDirectory })
    if (e.children) {
      result.push(...flattenFiles(e.children))
    }
  }
  return result
}

function showWebRow(query: string): boolean {
  const q = query.trim().toLowerCase()
  return !q || 'web'.startsWith(q)
}

export default function FileMentionMenu({ query, onSelect, onClose }: FileMentionMenuProps) {
  const fileTree = useStore((s) => s.fileTree)
  const [selected, setSelected] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const allFiles = flattenFiles(fileTree)
  const files = query
    ? allFiles.filter((f) => f.path.toLowerCase().includes(query.toLowerCase()))
    : allFiles.slice(0, 20)
  const items: MentionItem[] = showWebRow(query)
    ? [{ name: 'Web', path: '@web', isDirectory: false, isWeb: true }, ...files]
    : files

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, Math.max(0, items.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (items[selected]) {
        onSelect(items[selected].path)
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items, selected, onSelect, onClose])

  if (items.length === 0) return null

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 right-0 mb-2 bg-surface-2 border border-border rounded-lg shadow-xl overflow-hidden z-[90] max-h-60"
    >
      <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider border-b border-border">
        Mentions
      </div>
      <div className="overflow-y-auto max-h-48">
        {items.map((file, i) => (
          <button
            key={file.isWeb ? '@web' : file.path}
            onClick={() => onSelect(file.path)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-smooth ${
              i === selected
                ? 'bg-accent-muted text-accent'
                : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
            }`}
          >
            {file.isWeb ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent shrink-0">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
                <path d="M1.5 6h9M6 1.5c1.5 1.8 1.5 7.2 0 9M6 1.5c-1.5 1.8-1.5 7.2 0 9" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : file.isDirectory ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-warning shrink-0">
                <path d="M2 3h3l1 1h4v5H2V3z" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-muted shrink-0">
                <path d="M3 1h4l3 3v7H3V1z" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
            <span className="truncate font-mono text-xs">{file.isWeb ? '@web' : file.path}</span>
            {file.isWeb && <span className="ml-auto text-[10px] text-text-muted">Search the web</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
