import { useEffect, useRef } from 'react'
import { useStore } from '../store/store'

const DISMISS_MS: Record<'error' | 'info', number> = {
  error: 5000,
  info: 3500,
}

export default function ToastHost() {
  const toasts = useStore((s) => s.toasts)
  const dismissToast = useStore((s) => s.dismissToast)
  const timed = useRef(new Set<string>())

  useEffect(() => {
    for (const toast of toasts) {
      if (timed.current.has(toast.id)) continue
      timed.current.add(toast.id)
      window.setTimeout(() => {
        useStore.getState().dismissToast(toast.id)
        timed.current.delete(toast.id)
      }, DISMISS_MS[toast.kind] ?? 4000)
    }
  }, [toasts])

  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-10 right-3 z-[90] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto animate-fade-in rounded-lg border px-3 py-2 text-[12px] leading-5 shadow-xl ${
            toast.kind === 'error'
              ? 'bg-surface-2 border-danger/40 text-text-primary'
              : 'bg-surface-2 border-border text-text-secondary'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="min-w-0 flex-1 break-words">{toast.text}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 text-text-muted hover:text-text-primary"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
