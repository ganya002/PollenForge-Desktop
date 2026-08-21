import { useEffect, useState } from 'react'
import { useStore } from '../../store/store'

export default function TaskPanel() {
  const tasks = useStore((s) => s.tasks)
  const setTasks = useStore((s) => s.setTasks)
  const [expanded, setExpanded] = useState(false)

  const refresh = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8765/tools/list_tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: '' })
      })
      const data = await res.json()
      if (data.tasks) setTasks(data.tasks.map((t: any) => ({ id: t.id, name: t.name, command: t.command, status: t.status, exit_code: t.exit_code, created_at: t.created_at, duration_ms: t.duration_ms })))
    } catch {}
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [])

  if (tasks.length === 0) return null

  const running = tasks.filter(t => t.status === 'running' || t.status === 'queued').length

  return (
    <div className="border-t border-border">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-2 transition-smooth">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-text-muted flex items-center gap-2">
          Background Tasks
          {running > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
        </span>
        <span className="text-[10px] text-text-muted">{tasks.length}</span>
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-1 max-h-48 overflow-y-auto">
          {tasks.slice(0, 10).map(t => (
            <div key={t.id} className="rounded-md border border-border bg-surface-1 px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === 'running' ? 'bg-amber-500 animate-pulse' : t.status === 'done' ? 'bg-emerald-500' : t.status === 'failed' ? 'bg-red-500' : 'bg-text-muted'}`} />
                <span className="text-xs text-text-primary truncate flex-1">{t.name}</span>
                <span className="text-[10px] text-text-muted capitalize">{t.status}</span>
              </div>
              <div className="text-[10px] font-mono text-text-muted truncate mt-0.5">{t.command}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
