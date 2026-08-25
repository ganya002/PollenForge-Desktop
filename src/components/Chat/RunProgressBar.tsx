import { useEffect, useState } from 'react'
import { useStore, type ToolCall } from '../../store/store'
import {
  formatDuration,
  phaseLabel,
  runProgressCaption,
  toolActionLabel,
} from '../../lib/agentActivity'

interface Props {
  compact?: boolean
  toolCalls?: ToolCall[]
}

export default function RunProgressBar({ compact, toolCalls }: Props) {
  const progress = useStore((s) => s.runProgress)
  const isStreaming = useStore((s) => s.isStreaming)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!isStreaming) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [isStreaming])

  if (!isStreaming || !progress) return null

  const elapsedMs = Math.max(progress.elapsedMs, now - progress.startedAt)
  const percent = Math.max(3, Math.min(96, progress.percent))
  const current = progress.currentTool
    ? toolActionLabel(progress.currentTool, progress.currentPath)
    : phaseLabel(progress.phase)
  const caption = runProgressCaption({ ...progress, elapsedMs })
  const trail = (toolCalls || []).slice(-6)

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-0 text-accent">
        <div className="w-16 h-1.5 bg-surface-3 rounded-full overflow-hidden shrink-0">
          <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <span className="tabular-nums shrink-0">{percent}%</span>
        <span className="truncate max-w-[28rem]">
          Turn {Math.max(progress.iteration, 1)}/{progress.maxIterations} · {progress.toolsExecuted} tools · {progress.remainingTurns} left · {formatDuration(elapsedMs)} · {current}
        </span>
      </div>
    )
  }

  return (
    <div className="mt-1 ml-[18px] space-y-1 text-[13px] text-text-muted leading-relaxed">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden max-w-[16rem]">
          <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <span className="tabular-nums text-accent">{percent}%</span>
      </div>
      <div className="tabular-nums">{caption}</div>
      <div className="text-text-secondary">{current}</div>
      {trail.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[12px]">
          {trail.map((tc) => (
            <span key={tc.id} className={tc.status === 'running' ? 'text-accent' : 'opacity-70'}>
              {tc.status === 'done' ? '✓' : tc.status === 'error' ? '✕' : '→'} {tc.name.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
