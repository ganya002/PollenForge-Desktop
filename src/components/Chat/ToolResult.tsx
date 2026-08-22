import { useState, useMemo } from 'react'
import { ToolCall } from '../../store/store'

interface Props { toolCall: ToolCall }

const StatusIcon = ({ status, running }: { status: string; running: boolean }) => {
  if (status === 'running') return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="animate-spin text-amber-400"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.2" /><path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
  if (status === 'done') return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-emerald-400"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M5 8l2.2 2.2L11 6.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (status === 'error') return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-red-400"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  if (status === 'approval_needed') return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-violet-400"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-text-muted"><circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.3" /></svg>
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Queued', color: 'text-text-muted' },
  running: { label: 'Running', color: 'text-amber-400' },
  done: { label: 'Done', color: 'text-emerald-400' },
  error: { label: 'Error', color: 'text-red-400' },
  approval_needed: { label: 'Needs approval', color: 'text-violet-400' },
}

const LABELS: Record<string, string> = {
  run_command: 'Terminal',
  read_file: 'Read',
  write_file: 'Write',
  edit_file: 'Edit',
  list_dir: 'List',
  search_files: 'Search',
  find_files: 'Search',
  search_code: 'Search',
  read_folder: 'Read',
  open_app: 'Open',
  close_app: 'Close',
  git_status: 'Git status',
  git_diff: 'Git diff',
  git_diff_staged: 'Git diff',
  git_log: 'Git log',
  git_commit: 'Git commit',
  git_add: 'Git add',
  git_branch: 'Git branch',
  git_clone: 'Git clone',
  github_list_prs: 'GitHub',
  run_tests: 'Tests',
  run_build: 'Build',
  run_linter: 'Lint',
  show_diff: 'Diff',
  worktree_list: 'Worktree',
  start_background_task: 'Task',
}

function getPreview(tc: ToolCall): string {
  const a = tc.args as any
  if (tc.name === 'run_command' && a.command) return String(a.command).slice(0, 80)
  if (a.path) return String(a.path).slice(0, 80)
  if (a.file) return String(a.file).slice(0, 80)
  if (a.url) return String(a.url).slice(0, 80)
  if (a.pattern) return String(a.pattern).slice(0, 60)
  return ''
}

function getOutput(tc: ToolCall): { text: string; isError: boolean; truncated?: boolean } {
  const r: any = tc.result
  if (!r) return { text: '', isError: false }
  if (r.error) return { text: String(r.error), isError: true }
  if (r.blocked) return { text: `Blocked: ${r.error || 'dangerous command'}`, isError: true }
  if (r.stdout !== undefined) {
    const out = (r.stdout || '') + (r.stderr ? `\n${r.stderr}` : '')
    const code = r.exit_code !== undefined ? `\n— exit ${r.exit_code}${r.duration_ms ? ` in ${r.duration_ms}ms` : ''}` : ''
    return { text: (out.trim() + code).slice(0, 8000) || '(no output)', isError: r.exit_code !== 0 }
  }
  if (r.content !== undefined) return { text: String(r.content).slice(0, 8000), isError: false }
  if (r.diff !== undefined) return { text: String(r.diff).slice(0, 8000) || '(no changes)', isError: false }
  if (r.files !== undefined) return { text: JSON.stringify(r.files, null, 2).slice(0, 4000), isError: false }
  return { text: JSON.stringify(r, null, 2).slice(0, 4000), isError: false }
}

export default function ToolResult({ toolCall }: Props) {
  const isRunning = toolCall.status === 'running'
  const [expanded, setExpanded] = useState(isRunning)
  const [copied, setCopied] = useState(false)
  // Auto-expand when running, collapse when done is user-controlled
  const shouldExpand = isRunning ? true : expanded
  const status = STATUS[toolCall.status] || STATUS.pending
  const label = LABELS[toolCall.name] || toolCall.name.replace(/_/g, ' ')
  const preview = getPreview(toolCall)
  const { text: output, isError } = getOutput(toolCall)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output || JSON.stringify(toolCall.args, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const duration = useMemo(() => {
    if (toolCall.durationMs) return `${toolCall.durationMs}ms`
    if (toolCall.startedAt && isRunning) return `${Date.now() - toolCall.startedAt}ms`
    return null
  }, [toolCall.durationMs, toolCall.startedAt, isRunning])

  return (
    <div className={`group relative rounded-lg border bg-surface-1 overflow-hidden animate-fade-in ${isError ? 'border-red-500/20' : isRunning ? 'border-amber-500/20' : 'border-border'}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-px ${isRunning ? 'running-sheen bg-amber-400/70' : isError ? 'bg-red-400/50' : 'bg-white/15'}`} />
      <button
        onClick={() => setExpanded(!shouldExpand)}
        className="w-full flex items-center gap-2.5 pl-3 pr-2 py-2 text-left hover:bg-surface-2/40 transition-smooth"
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0"><StatusIcon status={toolCall.status} running={isRunning} /></span>
        <span className="text-xs font-medium text-text-primary capitalize">{label}</span>
        {preview && (
          <span className="text-[11px] text-text-muted font-mono truncate max-w-[320px] hidden sm:inline">{preview}</span>
        )}
        <span className="flex-1" />
        {duration && <span className="text-[10px] text-text-muted tabular-nums">{duration}</span>}
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isError ? 'bg-red-500/10 text-red-400' : isRunning ? 'bg-amber-500/10 text-amber-400' : 'bg-surface-2 text-text-muted'}`}>{status.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={`text-text-muted shrink-0 transition-transform ${shouldExpand ? 'rotate-180' : ''}`}><path d="M3 4.5l3 3 3-3z" /></svg>
      </button>

      {shouldExpand && (
        <div className="border-t border-border bg-surface-1">
          <div className="px-3 py-2">
            <div className="text-[10px] font-medium tracking-wider uppercase text-text-muted mb-1 flex items-center justify-between">
              <span>{toolCall.name === 'run_command' ? 'Command' : 'Arguments'}</span>
              <button onClick={handleCopy} className="text-[10px] normal-case tracking-normal font-mono px-1.5 py-0.5 rounded hover:bg-surface-3 text-text-muted hover:text-text-primary transition-smooth">
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="text-xs font-mono bg-surface-2 border border-border rounded-md px-2.5 py-2 overflow-x-auto whitespace-pre-wrap break-words text-text-secondary max-h-40 overflow-y-auto">
              {toolCall.name === 'run_command' ? (toolCall.args as any).command : JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {(toolCall.result || isRunning) && (
            <div className="px-3 pb-3">
              <div className="text-[10px] font-medium tracking-wider uppercase text-text-muted mb-1">Output</div>
              <pre className={`text-xs font-mono border border-border rounded-md px-2.5 py-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words ${isError ? 'bg-surface-2 text-danger' : 'bg-surface-2 text-text-secondary'}`}>
                {isRunning && !output ? 'Running…' : output || '(no output)'}
              </pre>
              {(toolCall.result as any)?.truncated && (
                <div className="text-[10px] text-text-muted mt-1">Output truncated. Use get_task_logs or read_file for full output.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
