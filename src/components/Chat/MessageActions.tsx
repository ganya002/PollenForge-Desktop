import { useState } from 'react'

interface MessageActionsProps {
  content: string
  isUser: boolean
  onRetry?: () => void
  onEdit?: (newContent: string) => void
}

export default function MessageActions({ content, isUser, onRetry, onEdit }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(content)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="flex-1 px-2 py-1 text-xs bg-surface-1 border border-accent rounded text-text-primary resize-none focus:outline-none"
          rows={2}
          autoFocus
        />
        <button
          onClick={() => { onEdit?.(editValue); setEditing(false) }}
          className="px-2 py-1 text-[10px] rounded bg-accent text-accent-ink hover:bg-accent-hover transition-smooth"
        >
          Send
        </button>
        <button
          onClick={() => { setEditing(false); setEditValue(content) }}
          className="px-2 py-1 text-[10px] rounded bg-surface-3 text-text-secondary hover:text-text-primary transition-smooth"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-surface-3 text-text-muted hover:text-text-secondary transition-smooth"
        title="Copy"
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1" />
            <path d="M2.5 8.5V2.5h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {isUser && (
        <button
          onClick={() => { setEditValue(content); setEditing(true) }}
          className="p-1 rounded hover:bg-surface-3 text-text-muted hover:text-text-secondary transition-smooth"
          title="Edit"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {!isUser && onRetry && (
        <button
          onClick={onRetry}
          className="p-1 rounded hover:bg-surface-3 text-text-muted hover:text-text-secondary transition-smooth"
          title="Retry"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6a4 4 0 1 1 1.17 2.83" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <path d="M2 3v3h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
