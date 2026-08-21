import { useStore } from '../store/store'

interface UpdateBadgeProps {
  onClick?: () => void
  variant?: 'pill' | 'icon'
}

export default function UpdateBadge({ onClick, variant = 'pill' }: UpdateBadgeProps) {
  const version = useStore((s) => s.availableUpdate)
  if (!version) return null

  const label = `Update to ${version}`

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        className="no-drag relative p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-smooth"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 2.5v7M5 7.2L8 10.5 11 7.2M3.5 13h9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#4d7cff]" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="no-drag inline-flex items-center gap-1 h-[22px] px-2.5 rounded-full bg-[#4d7cff] hover:bg-[#3d6aee] text-white text-[11px] font-medium leading-none select-none transition-smooth"
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 2.5v7M5 7.2L8 10.5 11 7.2M3.5 13h9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Update
    </button>
  )
}
