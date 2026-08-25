import { motion } from 'framer-motion'
import { Message as MessageType, ToolCall } from '../../store/store'
import ToolResult from './ToolResult'
import MessageActions from './MessageActions'
import MarkdownRenderer from './MarkdownRenderer'
import ThinkingBlock from './ThinkingBlock'
import { sanitizeAssistantContent } from '../../lib/sanitizeAssistantContent'
import { splitThinkTags } from '../../lib/thinking'
import { currentWorkspace } from '../../lib/workspace'
import { extractBrowserTargets } from '../../lib/browserTargets'
import { messageMatchesFind } from '../../lib/qol'
import { lineDeltaFromTool } from '../../lib/agentActivity'
import { useStore } from '../../store/store'
import { snappySpring, easeSnappy } from '../../lib/motion'

interface Props { message: MessageType; onRetry?: () => void; onEdit?: (c: string) => void }

function formatTime(ts: number): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

function FileChangeSummary({ toolCalls }: { toolCalls: ToolCall[] }) {
  const edits = toolCalls.filter((t) => t.name === 'write_file' || t.name === 'edit_file')
  if (edits.length < 2) return null
  let added = 0
  let removed = 0
  for (const t of edits) {
    const d = lineDeltaFromTool(t.name, t.args, t.result)
    added += d.added
    removed += d.removed
  }
  return (
    <div className="mb-1.5 text-[13px] text-text-muted flex items-center gap-2">
      <span>{edits.length} files changed</span>
      {added > 0 && <span className="text-emerald-400 tabular-nums">+{added}</span>}
      {removed > 0 && <span className="text-red-400 tabular-nums">-{removed}</span>}
    </div>
  )
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
      <motion.div
        id={`msg-${message.id}`}
        initial={{ opacity: 0, y: 6, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={snappySpring}
        className={`flex justify-end mb-5 group ${findHit ? 'chat-find-hit' : ''}`}
      >
        <div className="max-w-[78%]">
          {message.images && message.images.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end mb-1.5">
              {message.images.map((src, i) => (
                <motion.img
                  key={i}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={snappySpring}
                  src={src}
                  alt={`attachment ${i + 1}`}
                  className="max-h-40 max-w-[240px] rounded-xl border border-border object-cover cursor-zoom-in hover:border-border-hover transition-snappy"
                  onClick={() => window.open(src, '_blank')}
                />
              ))}
            </div>
          )}
          <motion.div
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.12, ease: easeSnappy }}
            className="bg-surface-2/80 text-text-primary rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words shadow-sm hover:shadow-md transition-snappy"
          >
            {message.content}
          </motion.div>
          <div className="flex items-center gap-2 mt-1.5 justify-end">
            <span className="text-[10px] text-text-muted tabular-nums">{formatTime(message.timestamp)}</span>
            <MessageActions content={message.content} isUser={isUser} onRetry={onRetry} onEdit={onEdit} />
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      id={`msg-${message.id}`}
      layout
      className={`mb-6 group ${findHit ? 'chat-find-hit' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.14, ease: easeSnappy }}
    >
      <ThinkingBlock reasoning={reasoning} active={isLive} toolCalls={message.toolCalls} />

      {hasTools && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: easeSnappy }}
          className="space-y-0.5 mb-3"
        >
          <FileChangeSummary toolCalls={message.toolCalls!} />
          {message.toolCalls!.map((tc, i) => (
            <motion.div
              key={tc.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, ...snappySpring }}
            >
              <ToolResult toolCall={tc} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {hasContent && (
        <div className={`relative ${message.isError ? 'bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3' : ''}`}>
          <div className={`${message.isError ? '' : 'px-1'} markdown-body text-[14px] leading-relaxed min-w-0`}>
            <MarkdownRenderer content={displayContent} />
            {isStreaming && <span className="inline-block w-1.5 h-4 bg-accent animate-stream-caret ml-0.5 -mb-1 rounded-sm" />}
            {browserLinks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, ...snappySpring }}
                className="flex flex-wrap gap-1.5 mt-2"
              >
                {browserLinks.map((hit) => (
                  <motion.button
                    key={hit.url}
                    onClick={() => useStore.getState().openInBrowser(hit.url)}
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="h-7 px-2.5 rounded-md border border-border bg-surface-2 text-[12px] text-text-secondary hover:text-text-primary hover:border-border-hover transition-snappy"
                  >
                    {hit.label.startsWith('Open ') ? hit.label : `Open ${hit.label}`}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </div>
          {message.stats && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.18, ease: easeSnappy }}
              className="mt-3 flex items-center gap-2.5 text-[10px] text-text-muted flex-wrap border-t border-border/40 pt-2.5"
            >
              <span className="tabular-nums inline-flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-success animate-pulse-dot" />{message.stats.tokens.toLocaleString()} tokens</span>
              <span>·</span>
              <span className="tabular-nums">{(message.stats.duration_ms / 1000).toFixed(1)}s</span>
              <span>·</span>
              <span className="font-mono">{message.stats.model}</span>
              {message.stats.tools_used > 0 && <><span>·</span><span className="inline-flex items-center gap-1">{message.stats.tools_used} tool{message.stats.tools_used>1?'s':''} {message.stats.tools_used>2 && <span className="text-success">✓</span>}</span></>}
              {message.stats.iterations && message.stats.iterations > 1 && <><span>·</span><span>{message.stats.iterations} turns</span></>}
            </motion.div>
          )}
        </div>
      )}

      {(hasContent || hasTools || reasoning.trim()) && !isLive && (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        >
          <span className="text-[10px] text-text-muted tabular-nums">{formatTime(message.timestamp)}</span>
          <MessageActions content={displayContent} isUser={false} onRetry={onRetry} onEdit={onEdit} />
        </motion.div>
      )}
    </motion.div>
  )
}
