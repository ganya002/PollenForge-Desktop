import { Message as MessageType } from '../../store/store'
import ToolResult from './ToolResult'
import MessageActions from './MessageActions'
import MarkdownRenderer from './MarkdownRenderer'
import ThinkingBlock from './ThinkingBlock'
import { sanitizeAssistantContent } from '../../lib/sanitizeAssistantContent'
import { splitThinkTags } from '../../lib/thinking'
import { currentWorkspace } from '../../lib/workspace'
import { extractBrowserTargets } from '../../lib/browserTargets'
import { messageMatchesFind } from '../../lib/qol'
import { useStore } from '../../store/store'

interface Props { message: MessageType; onRetry?: () => void; onEdit?: (c: string) => void }

function formatTime(ts: number): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export default function Message({ message, onRetry, onEdit }: Props) {
  const isUser = message.role === 'user'
  const hasTools = !!message.toolCalls?.length
  const chatFind = useStore((s) => s.chatFind)
  const lastId = useStore((s) => s.messages[s.messages.length - 1]?.id)
  const live = useStore((s) => s.isStreaming)
  const tagged = isUser ? { content: message.content, reasoning: '' } : splitThinkTags(message.content || '')
  const reasoning = [message.reasoning, tagged.reasoning].filter((part) => part?.trim()).join('\n\n')
  const displayContent = isUser ? message.content : sanitizeAssistantContent(tagged.content)
  const findHit = !!chatFind.trim() && (
    messageMatchesFind(message.content, chatFind) || messageMatchesFind(reasoning, chatFind)
  )
  const browserLinks = !isUser ? extractBrowserTargets(displayContent, currentWorkspace()) : []
  const isLive = !isUser && live && message.id === lastId && !message.stats && !message.isError
  const isStreaming = isLive && !!displayContent
  const hasContent = !!displayContent.trim()

  if (isUser) {
    return (
      <div id={`msg-${message.id}`} className={`flex justify-end mb-5 group ${findHit ? 'chat-find-hit' : ''}`}>
        <div className="max-w-[78%]">
          <div className="bg-surface-2 text-text-primary rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words border border-border transition-smooth">
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

  return (
    <div id={`msg-${message.id}`} className={`mb-6 group ${findHit ? 'chat-find-hit' : ''}`}>
      <ThinkingBlock reasoning={reasoning} active={isLive} toolCalls={message.toolCalls} />

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
            {browserLinks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {browserLinks.map((hit) => (
                  <button
                    key={hit.url}
                    onClick={() => useStore.getState().openInBrowser(hit.url)}
                    className="h-7 px-2.5 rounded-md border border-border bg-surface-2 text-[12px] text-text-secondary hover:text-text-primary"
                  >
                    {hit.label.startsWith('Open ') ? hit.label : `Open ${hit.label}`}
                  </button>
                ))}
              </div>
            )}
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

      {(hasContent || hasTools || reasoning.trim()) && !isLive && (
        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="text-[10px] text-text-muted tabular-nums">{formatTime(message.timestamp)}</span>
          <MessageActions content={displayContent} isUser={false} onRetry={onRetry} onEdit={onEdit} />
        </div>
      )}
    </div>
  )
}
