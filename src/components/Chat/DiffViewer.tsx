import { useState } from 'react'

interface Props {
  diff: string
  fileName?: string
}

export default function DiffViewer({ diff, fileName }: Props) {
  const [view, setView] = useState<'unified' | 'split'>('unified')
  const lines = diff.split('\n')
  const hasDiff = diff.trim().length > 0

  if (!hasDiff) {
    return (
      <div className="rounded-lg border border-border bg-surface-1 p-4 text-center text-sm text-text-muted">
        No changes
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-surface-0">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-b border-border">
        <span className="text-xs font-medium text-text-secondary truncate">{fileName || 'Changes'}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('unified')}
            className={`px-2 py-1 text-[10px] rounded ${view === 'unified' ? 'bg-accent text-white' : 'bg-surface-2 text-text-muted hover:text-text-primary'}`}
          >Unified</button>
          <button
            onClick={() => setView('split')}
            className={`px-2 py-1 text-[10px] rounded ${view === 'split' ? 'bg-accent text-white' : 'bg-surface-2 text-text-muted hover:text-text-primary'}`}
          >Split</button>
        </div>
      </div>
      <div className="max-h-80 overflow-auto">
        {lines.map((line, i) => {
          if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
            return <div key={i} className="diff-hunk px-3 py-0.5 text-xs font-mono bg-surface-2 text-text-muted border-y border-border/30">{line}</div>
          }
          if (line.startsWith('+')) {
            return <div key={i} className="diff-add px-3 py-0.5 text-xs font-mono bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500">+ {line.slice(1)}</div>
          }
          if (line.startsWith('-')) {
            return <div key={i} className="diff-remove px-3 py-0.5 text-xs font-mono bg-red-500/10 text-red-300 border-l-2 border-red-500">- {line.slice(1)}</div>
          }
          return <div key={i} className="px-3 py-0.5 text-xs font-mono text-text-secondary">{line || ' '}</div>
        })}
      </div>
    </div>
  )
}
