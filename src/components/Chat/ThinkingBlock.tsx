import { useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

interface Props {
  reasoning: string
  active: boolean
}

export default function ThinkingBlock({ reasoning, active }: Props) {
  const [open, setOpen] = useState(false)
  const text = reasoning.trim()
  if (!active && !text) return null

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 py-0.5 text-[13px] text-text-muted hover:text-text-secondary transition-smooth"
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
        <span className={active ? 'thinking-shimmer' : ''}>Thinking</span>
      </button>
      {open && text ? (
        <div className="mt-1.5 ml-1 pl-3 border-l border-border thinking-body markdown-body text-[13px] leading-relaxed">
          <MarkdownRenderer content={text} />
        </div>
      ) : null}
    </div>
  )
}
