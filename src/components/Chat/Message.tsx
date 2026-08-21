import { Message as MessageType } from '../../store/store'
import ToolResult from './ToolResult'
import StreamingText from './StreamingText'
import MessageActions from './MessageActions'
import MarkdownRenderer from './MarkdownRenderer'
import { sanitizeAssistantContent } from '../../lib/sanitizeAssistantContent'

interface Props { message: MessageType; onRetry?: () => void; onEdit?: (c: string) => void }

function formatTime(ts: number): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export default function Message({ message, onRetry, onEdit }: Props) {
  const isUser = message.role === 'user'
  const hasTools = !!message.toolCalls?.length
  const displayContent = isUser ? message.content : sanitizeAssistantContent(message.content || '')
  const isThinking = !isUser && !displayContent && !hasTools
  const isStreaming = !isUser && !!displayContent && !message.stats && !message.isError
  const hasContent = !!displayContent.trim()

  if (isUser) {
    return (
      <div className="flex justify-end mb-5 group">
        <div className="max-w-[78%]">
          <div className="bg-surface-2 text-text-primary rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words border border-border">
            {message.content}
          </div>
          <div className="flex items-center gap-2 mt-1.5 justify-end">
            <span className="text-[10px] text-text-muted tabular-nums">{formatTime(message.timestamp)}</span>
            <MessageActions content={message.content} isUser={isUser} onRetry={onRetry} onEdit={onEdit} />
          </div>
        </div>
      </div>
    )
  }

  // Assistant - Codex style: no bubble, timeline then markdown
  return (
    <div className="mb-6 group">
      {isThinking && (
        <div className="flex items-center gap-2.5 py-2 text-text-muted">
          <StreamingText />
          <span className="text-xs">Working…</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-border">thinking</span>
        </div>
      )}

      {hasTools && (
        <div className="space-y-2 mb-3">
          {message.toolCalls!.map(tc => (
            <ToolResult key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}

      {hasContent && (
        <div className={`relative ${message.isError ? 'bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3' : ''}`}>
          <div className={`${message.isError ? '' : 'px-1'} markdown-body text-[14px] leading-relaxed min-w-0`}>
            <MarkdownRenderer content={displayContent} />
            {isStreaming && <span className="inline-block w-2 h-4 bg-accent/70 animate-pulse ml-0.5 -mb-1 rounded-sm" />}
          </div>
          {message.stats && (
            <div className="mt-3 flex items-center gap-2.5 text-[10px] text-text-muted flex-wrap border-t border-border/40 pt-2.5">
              <span className="tabular-nums">{message.stats.tokens.toLocaleString()} tokens</span>
              <span>·</span>
              <span className="tabular-nums">{(message.stats.duration_ms / 1000).toFixed(1)}s</span>
              <span>·</span>
              <span className="font-mono">{message.stats.model}</span>
              {message.stats.tools_used > 0 && <><span>·</span><span>{message.stats.tools_used} tool{message.stats.tools_used>1?'s':''}</span></>}
              {message.stats.iterations && message.stats.iterations > 1 && <><span>·</span><span>{message.stats.iterations} turns</span></>}
            </div>
          )}
        </div>
      )}

      {!isThinking && (hasContent || hasTools) && (
        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-text-muted tabular-nums">{formatTime(message.timestamp)}</span>
          <MessageActions content={displayContent} isUser={false} onRetry={onRetry} onEdit={onEdit} />
        </div>
      )}
    </div>
  )
}
