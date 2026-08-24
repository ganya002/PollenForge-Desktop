import { useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import { useStore, type ToolCall } from '../../store/store'
import { summarizeAgentActivity } from '../../lib/agentActivity'

interface Props {
  reasoning: string
  active: boolean
  toolCalls?: ToolCall[]
}

function LineDelta({ added, removed }: { added: number; removed: number }) {
  if (added <= 0 && removed <= 0) return null
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {added > 0 && <span className="text-emerald-400/90">+{added}</span>}
      {removed > 0 && <span className="text-red-400/90">-{removed}</span>}
    </span>
  )
}

export default function ThinkingBlock({ reasoning, active, toolCalls }: Props) {
  const swarm = useStore((s) => s.swarm)
  const [open, setOpen] = useState(false)
  const text = reasoning.trim()
  const activity = summarizeAgentActivity({ toolCalls, swarm: active ? swarm : null, streaming: active })
  if (!active && !text) return null

  const label = activity.headline || (active ? 'Thinking' : 'Thought')
  const showLive = active && activity.hasWork
  const showCurrent = showLive && activity.current && activity.current !== label && !label.endsWith(activity.current)

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 py-0.5 text-[13px] text-text-muted hover:text-text-secondary transition-smooth min-w-0 max-w-full"
        aria-expanded={open}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="currentColor"
          className={`shrink-0 opacity-70 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          aria-hidden
        >
          <path d="M4.2 2.2l4.2 3.8-4.2 3.8V2.2z" />
        </svg>
        <span className={`truncate ${active ? 'thinking-shimmer' : ''}`}>{label}</span>
        {!active && <LineDelta added={activity.added} removed={activity.removed} />}
      </button>
      {showLive && (
        <div className="mt-0.5 ml-[18px] space-y-0.5 text-[13px] text-text-muted leading-relaxed">
          {activity.summary && <div>{activity.summary}</div>}
          {(activity.detail || activity.added > 0 || activity.removed > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              {activity.detail && <span>{activity.detail}</span>}
              <LineDelta added={activity.added} removed={activity.removed} />
            </div>
          )}
          {showCurrent && <div>{activity.current}</div>}
        </div>
      )}
      {open && text ? (
        <div className="mt-1.5 ml-1 pl-3 border-l border-border thinking-body markdown-body text-[13px] leading-relaxed">
          <MarkdownRenderer content={text} />
        </div>
      ) : null}
    </div>
  )
}
