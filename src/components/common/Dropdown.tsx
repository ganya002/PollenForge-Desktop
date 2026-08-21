import { useState, useRef, useEffect, ReactNode } from 'react'

interface DropdownItem {
  label: string
  value: string
  icon?: ReactNode
  danger?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  onSelect: (value: string) => void
  align?: 'left' | 'right'
}

export default function Dropdown({ trigger, items, onSelect, align = 'left' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => (s + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => (s - 1 + items.length) % items.length)
    } else if (e.key === 'Enter' && selected >= 0) {
      e.preventDefault()
      onSelect(items[selected].value)
      setOpen(false)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          onKeyDown={handleKeyDown}
          className={`absolute top-full mt-1 z-50 bg-surface-2 border border-border rounded-lg shadow-xl py-1 min-w-[160px] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, i) => (
            <button
              key={item.value}
              onClick={() => {
                onSelect(item.value)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-smooth ${
                i === selected ? 'bg-accent-muted text-accent' : ''
              } ${
                item.danger
                  ? 'text-danger hover:bg-danger/10'
                  : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
              }`}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
