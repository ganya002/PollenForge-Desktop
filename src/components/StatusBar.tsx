import { useStore } from '../store/store'
import { findProviderModel } from '../lib/appConfig'
import UpdateBadge from './UpdateBadge'

interface StatusBarProps {
  onOpenUpdates?: () => void
}

export default function StatusBar({ onOpenUpdates }: StatusBarProps) {
  const wsConnected = useStore((s) => s.wsConnected)
  const currentModel = useStore((s) => s.currentModel)
  const currentProvider = useStore((s) => s.currentProvider)
  const isStreaming = useStore((s) => s.isStreaming)
  const totalTokensUsed = useStore((s) => s.totalTokensUsed)
  const totalCost = useStore((s) => s.totalCost)
  const messages = useStore((s) => s.messages)
  const config = useStore((s) => s.config)
  const tasks = useStore((s) => s.tasks)

  const totalChars = messages.reduce((acc, m) => acc + m.content.length + (m.toolCalls?.reduce((a, tc) => a + JSON.stringify(tc.args).length, 0) || 0), 0)
  const estimatedTokens = Math.ceil(totalChars / 4)
  const modelInfo = findProviderModel(config, currentProvider, currentModel)
  const maxTokens = modelInfo?.context_length || 128000
  const contextPercent = Math.min(100, Math.round((estimatedTokens / maxTokens) * 100))

  const lastStats = [...messages].reverse().find(m => m.role === 'assistant' && m.stats)?.stats
  const runningTasks = tasks.filter(t => t.status === 'running' || t.status === 'queued').length

  return (
    <div className="h-7 flex items-center justify-between px-3 bg-surface-1 border-t border-border text-[11px] text-text-muted select-none shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 shadow-sm' : 'bg-red-500 animate-pulse'}`} />
          <span className={wsConnected ? '' : 'text-red-400'}>{wsConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <UpdateBadge variant="pill" onClick={onOpenUpdates} />
        {isStreaming && (
          <div className="flex items-center gap-1.5 text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span>Generating…</span>
          </div>
        )}
        {runningTasks > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>{runningTasks} task{runningTasks>1?'s':''}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {estimatedTokens > 500 && (
          <div className="flex items-center gap-1.5" title={`${estimatedTokens.toLocaleString()} tokens / ${maxTokens.toLocaleString()} context`}>
            <div className="w-14 h-1.5 bg-surface-3 rounded-full overflow-hidden hidden sm:block">
              <div className={`h-full rounded-full transition-all ${contextPercent > 85 ? 'bg-red-500' : contextPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(4, contextPercent)}%` }} />
            </div>
            <span className="tabular-nums">{contextPercent}%</span>
            <span className="hidden md:inline tabular-nums opacity-60">· {estimatedTokens.toLocaleString()} tok</span>
          </div>
        )}
        {lastStats && (
          <span className="hidden lg:inline tabular-nums opacity-70">
            {lastStats.tokens.toLocaleString()} tok · {(lastStats.duration_ms/1000).toFixed(1)}s
          </span>
        )}
        {totalTokensUsed > 0 && (
          <span className="tabular-nums hidden sm:inline">
            {totalTokensUsed.toLocaleString()} total{totalCost > 0 && ` · $${totalCost.toFixed(3)}`}
          </span>
        )}
      </div>
    </div>
  )
}
