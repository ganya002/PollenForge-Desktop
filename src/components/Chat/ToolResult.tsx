import { useState, useMemo } from 'react'
import { ToolCall, useStore } from '../../store/store'
import { toolPath } from '../../lib/qol'
import { fileName, lineDeltaFromTool } from '../../lib/agentActivity'
import { currentWorkspace } from '../../lib/workspace'
import { openWorkspaceFile } from '../../lib/workspaceFiles'
import { isSafeBrowserUrl } from '../../lib/browserTargets'

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
  spawn_swarm: 'Swarm',
  remember: 'Memory',
  forget_memory: 'Memory',
  list_memories: 'Memory',
  generate_image: 'Image',
  web_search: 'Web search',
  fetch_url: 'Fetch URL',
}

function getPreview(tc: ToolCall): string {
  const a = tc.args as any
  if (tc.name === 'run_command' && a.command) return String(a.command).slice(0, 80)
  if (tc.name === 'spawn_swarm') return String(a.goal || a.tasks || 'parallel agents').slice(0, 80)
  if (tc.name === 'remember') return String(a.text || a.note || '').slice(0, 80)
  if (a.prompt) return String(a.prompt).slice(0, 80)
  if (a.query) return String(a.query).slice(0, 80)
  if (a.path) return String(a.path).slice(0, 80)
  if (a.file) return String(a.file).slice(0, 80)
  if (a.url) return String(a.url).slice(0, 80)
  if (a.pattern) return String(a.pattern).slice(0, 60)
  return ''
}

function displayArgs(tc: ToolCall): string {
  if (tc.name === 'run_command') return String((tc.args as { command?: string }).command || '')
  const args: Record<string, unknown> = { ...(tc.args || {}) }
  for (const key of ['content', 'new', 'old', 'text']) {
    const v = args[key]
    if (typeof v === 'string' && v.length > 480) args[key] = `${v.slice(0, 480)}…`
  }
  return JSON.stringify(args, null, 2)
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
  if (r.success && (r.bytes_written != null || r.path)) {
    const bytes = r.bytes_written != null ? `${r.bytes_written} bytes` : 'saved'
    return { text: `Wrote ${bytes}`, isError: false }
  }
  if (Array.isArray(r.results)) {
    const lines = r.results.map((item: { title?: string; url?: string; snippet?: string }) => {
      const title = item?.title || item?.url || 'result'
      const url = item?.url ? ` ${item.url}` : ''
      const snippet = item?.snippet ? `\n  ${item.snippet}` : ''
      return `${title}${url}${snippet}`
    })
    if (r.answer) lines.unshift(String(r.answer).slice(0, 2000))
    return { text: lines.join('\n').slice(0, 4000) || '(no results)', isError: false }
  }
  if (r.files !== undefined) return { text: JSON.stringify(r.files, null, 2).slice(0, 4000), isError: false }
  return { text: JSON.stringify(r, null, 2).slice(0, 4000), isError: false }
}

export default function ToolResult({ toolCall }: Props) {
  const isRunning = toolCall.status === 'running'
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const shouldExpand = isRunning || expanded
  const status = STATUS[toolCall.status] || STATUS.pending
  const label = LABELS[toolCall.name] || toolCall.name.replace(/_/g, ' ')
  const preview = getPreview(toolCall)
  const path = toolPath(toolCall.args)
  const delta = lineDeltaFromTool(toolCall.name, toolCall.args, toolCall.result)
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

  const result = toolCall.result as Record<string, unknown> | undefined
  const imageUrl = toolCall.name === 'generate_image' && typeof result?.url === 'string' && isSafeBrowserUrl(result.url)
    ? result.url
    : ''
  const searchResults = toolCall.name === 'web_search' && Array.isArray(result?.results)
    ? (result.results as Array<{ title?: string; url?: string; snippet?: string }>)
    : null
  const searchAnswer = toolCall.name === 'web_search' && typeof result?.answer === 'string' ? result.answer : ''

  const openUrl = (url: string) => {
    if (isSafeBrowserUrl(url)) useStore.getState().openInBrowser(url)
  }

  return (
    <div className={`group relative rounded-lg overflow-hidden animate-fade-in ${
      isError ? 'border border-red-500/20 bg-surface-1' : isRunning ? 'bg-surface-1/80' : ''
    }`}>
      <div className="w-full flex items-center gap-2 pl-0.5 pr-1 py-1 hover:bg-surface-2/50 rounded-lg transition-smooth">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <span className="w-4 h-4 flex items-center justify-center shrink-0"><StatusIcon status={toolCall.status} running={isRunning} /></span>
          <span className="text-[13px] text-text-secondary">{label}</span>
          {preview && !path && (
            <span className="text-[12px] text-text-muted font-mono truncate max-w-[320px] hidden sm:inline">{preview}</span>
          )}
        </button>
        {preview && !!path && (
          <button
            type="button"
            onClick={() => void openWorkspaceFile(path, { root: currentWorkspace() })}
            className="text-[12px] text-text-muted font-mono truncate max-w-[280px] hidden sm:inline hover:text-text-primary"
            title="Open file"
          >
            {fileName(path) || preview}
          </button>
        )}
        {(delta.added > 0 || delta.removed > 0) && (
          <span className="text-[11px] tabular-nums shrink-0 inline-flex items-center gap-1.5">
            {delta.added > 0 && <span className="text-emerald-400">+{delta.added}</span>}
            {delta.removed > 0 && <span className="text-red-400">-{delta.removed}</span>}
          </span>
        )}
        {duration && isRunning && <span className="text-[10px] text-text-muted tabular-nums">{duration}</span>}
        {(isRunning || isError || toolCall.status === 'approval_needed') && (
          <span className={`text-[10px] shrink-0 ${isError ? 'text-red-400' : isRunning ? 'text-amber-400' : 'text-violet-400'}`}>{status.label}</span>
        )}
      </div>

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
              {toolCall.name === 'run_command' ? (toolCall.args as any).command : displayArgs(toolCall)}
            </pre>
          </div>

          {(toolCall.result || isRunning) && (
            <div className="px-3 pb-3">
              <div className="text-[10px] font-medium tracking-wider uppercase text-text-muted mb-1">Output</div>
              {imageUrl && !isError ? (
                <img
                  src={imageUrl}
                  alt={String((toolCall.args as { prompt?: string }).prompt || 'Generated image')}
                  className="max-w-full rounded-md border border-border cursor-pointer"
                  style={{ maxHeight: 360 }}
                  onClick={() => openUrl(imageUrl)}
                />
              ) : searchResults && !isError ? (
                <div className="space-y-2">
                  {searchAnswer && (
                    <p className="text-xs text-text-secondary whitespace-pre-wrap break-words">{searchAnswer.slice(0, 2000)}</p>
                  )}
                  {searchResults.length === 0 && !searchAnswer && (
                    <div className="text-xs text-text-muted">No results</div>
                  )}
                  {searchResults.map((item, i) => (
                    <button
                      key={`${item.url || i}`}
                      type="button"
                      onClick={() => item.url && openUrl(item.url)}
                      className="block w-full text-left rounded-md border border-border bg-surface-2 px-2.5 py-2 hover:bg-surface-3 transition-smooth"
                    >
                      <div className="text-xs text-accent truncate">{item.title || item.url}</div>
                      {item.url && <div className="text-[10px] text-text-muted truncate">{item.url}</div>}
                      {item.snippet && <div className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">{item.snippet}</div>}
                    </button>
                  ))}
                </div>
              ) : (
                <pre className={`text-xs font-mono border border-border rounded-md px-2.5 py-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words ${isError ? 'bg-surface-2 text-danger' : 'bg-surface-2 text-text-secondary'}`}>
                  {isRunning && !output ? 'Running…' : output || '(no output)'}
                </pre>
              )}
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
