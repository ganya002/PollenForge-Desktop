import { useEffect } from 'react'

interface KeyboardHelpProps {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  { category: 'General', items: [
    { keys: ['Enter'], description: 'Send message' },
    { keys: ['Shift', 'Enter'], description: 'New line' },
    { keys: ['Escape'], description: 'Cancel/Close' },
  ]},
  { category: 'Navigation', items: [
    { keys: ['Cmd', 'B'], description: 'Toggle sidebar' },
    { keys: ['Cmd', 'K'], description: 'Command palette' },
    { keys: ['Cmd', 'Shift', 'K'], description: 'Clear chat' },
    { keys: ['Cmd', 'N'], description: 'New chat' },
    { keys: ['Cmd', ','], description: 'Open settings' },
  ]},
  { category: 'Chat', items: [
    { keys: ['/'], description: 'Show commands' },
    { keys: ['@'], description: 'Mention file' },
    { keys: ['Tab'], description: 'Accept suggestion' },
  ]},
]

export default function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface-2 rounded-xl border border-border shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-smooth">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{group.category}</h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.description} className="flex items-center justify-between py-1">
                    <span className="text-sm text-text-secondary">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="px-1.5 py-0.5 bg-surface-3 rounded text-[10px] text-text-muted font-mono border border-border"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-border text-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-surface-3 hover:bg-surface-2 text-text-secondary hover:text-text-primary text-sm rounded-lg transition-smooth"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
