import { useState, useEffect, useRef } from 'react'
import { useStore, FileEntry } from '../../store/store'

interface FileMentionMenuProps {
  query: string
  onSelect: (path: string) => void
  onClose: () => void
}

function flattenFiles(entries: FileEntry[]): { name: string; path: string; isDirectory: boolean }[] {
  const result: { name: string; path: string; isDirectory: boolean }[] = []
  for (const e of entries) {
    result.push({ name: e.name, path: e.path, isDirectory: e.isDirectory })
    if (e.children) {
      result.push(...flattenFiles(e.children))
    }
  }
  return result
}

export default function FileMentionMenu({ query, onSelect, onClose }: FileMentionMenuProps) {
  const fileTree = useStore((s) => s.fileTree)
  const [selected, setSelected] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const allFiles = flattenFiles(fileTree)
  const filtered = query
    ? allFiles.filter((f) => f.path.toLowerCase().includes(query.toLowerCase()))
    : allFiles.slice(0, 20)

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
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (filtered[selected]) {
        onSelect(filtered[selected].path)
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, selected, onSelect, onClose])

  if (filtered.length === 0) return null

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 right-0 mb-2 bg-surface-2 border border-border rounded-lg shadow-xl overflow-hidden z-50 max-h-60"
    >
      <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider border-b border-border">
        Files
      </div>
      <div className="overflow-y-auto max-h-48">
        {filtered.map((file, i) => (
          <button
            key={file.path}
            onClick={() => onSelect(file.path)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-smooth ${
              i === selected
                ? 'bg-accent-muted text-accent'
                : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
            }`}
          >
            {file.isDirectory ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-warning shrink-0">
                <path d="M2 3h3l1 1h4v5H2V3z" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-muted shrink-0">
                <path d="M3 1h4l3 3v7H3V1z" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
            <span className="truncate font-mono text-xs">{file.path}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
