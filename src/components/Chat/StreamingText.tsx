export default function StreamingText() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" style={{ animationDelay: '200ms' }} />
      <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" style={{ animationDelay: '400ms' }} />
    </div>
  )
}
