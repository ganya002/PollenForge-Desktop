import { apiFetch } from '../../lib/api'
import { useEffect } from 'react'
import { useStore } from '../../store/store'

export default function WorktreeIndicator() {
  const worktrees = useStore((s) => s.worktrees)
  const setWorktrees = useStore((s) => s.setWorktrees)

  useEffect(() => {
    const fetchWorktrees = async () => {
      try {
        const res = await apiFetch('http://127.0.0.1:8765/tools/worktree_list', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '.' })
        })
        const data = await res.json()
        if (data.worktrees) setWorktrees(data.worktrees)
      } catch {}
    }
    fetchWorktrees()
  }, [setWorktrees])

  if (worktrees.length <= 1) return null

  return (
    <div className="px-3 py-2 border-b border-border">
      <div className="text-[11px] font-medium tracking-wider uppercase text-text-muted mb-1.5">Worktrees</div>
      <div className="space-y-1">
        {worktrees.map(w => (
          <div key={w.path} className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-2 border border-border text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <span className="truncate text-text-primary flex-1">{w.branch || 'detached'}</span>
            <span className="text-[10px] text-text-muted truncate max-w-[100px]">{w.path.split('/').pop()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
