import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/store'

const DANGEROUS_TOOLS = ['run_command', 'write_file', 'edit_file', 'close_app']
const TOOL_LABELS: Record<string, string> = {
  run_command: 'Run shell command',
  write_file: 'Write to file',
  edit_file: 'Edit file',
  read_file: 'Read file',
  list_dir: 'List directory',
  search_files: 'Search files',
  open_app: 'Open application',
  close_app: 'Close application',
  read_folder: 'Read folder',
}

export default function ApprovalPrompt() {
  const pendingApproval = useStore((s) => s.pendingApproval)
  const approveTool = useStore((s) => s.approveTool)

  if (!pendingApproval) return null

  const { tool, args, requestId } = pendingApproval
  const isDangerous = DANGEROUS_TOOLS.includes(tool)
  const label = TOOL_LABELS[tool] || tool

  const getArgSummary = (): string => {
    if (tool === 'run_command') return `$ ${args.command || ''}`
    if (tool === 'write_file' || tool === 'edit_file') return String(args.path || '')
    if (tool === 'read_file') return String(args.path || '')
    if (tool === 'list_dir') return String(args.path || '.')
    if (tool === 'search_files') return String(args.pattern || '')
    if (tool === 'open_app') return String(args.app || '')
    return JSON.stringify(args)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="composer-col mb-3 px-4"
      >
        <div className={`rounded-xl border overflow-hidden ${isDangerous ? 'border-warning/40 bg-warning/5' : 'border-border bg-surface-2'}`}>
          <div className="flex items-center gap-2 px-4 py-2.5">
            {isDangerous ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-warning shrink-0">
                <path d="M7 1L1 13h12L7 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <line x1="7" y1="5.5" x2="7" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="7" cy="10.5" r="0.5" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-accent shrink-0">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 4.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="7" cy="9.5" r="0.5" fill="currentColor" />
              </svg>
            )}
            <span className="text-sm font-medium text-text-primary">{label}</span>
            {isDangerous && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">DANGEROUS</span>}
          </div>

          <div className="px-4 pb-2">
            <code className="text-xs text-text-secondary font-mono bg-surface-0 rounded px-2 py-1 block truncate">
              {getArgSummary()}
            </code>
          </div>

          <div className="flex items-center gap-2 px-4 pb-3">
            <button
              onClick={() => approveTool(true)}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent hover:bg-accent-hover text-accent-ink transition-smooth"
            >
              Allow
            </button>
            <button
              onClick={() => approveTool(false)}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-3 hover:bg-surface-3/80 text-text-secondary hover:text-text-primary transition-smooth"
            >
              Deny
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
