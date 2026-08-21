import { useCallback, useRef, useEffect } from 'react'
import { useStore, Message, ToolCall } from '../store/store'
import { findProviderModel } from '../lib/appConfig'
import { applyActivePlugins, activePluginIds } from '../lib/plugins'
import { refreshSessions, nameSessionFromPrompt } from '../lib/sessions'
import { currentWorkspace, savePlanMarkdown, scheduleFileTreeRefresh } from '../lib/workspace'
import { titleFromPrompt } from '../lib/chatTitle'
import { shouldRefreshFileTree } from '../lib/fileTreeSync'
import { sanitizeAssistantContent } from '../lib/sanitizeAssistantContent'
import { useWebSocket } from './useWebSocket'

function genId(): string {
  return Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 6)
}

export function useChat() {
  const messages = useStore((s) => s.messages)
  const isStreaming = useStore((s) => s.isStreaming)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  const ws = useWebSocket({
    onToken: useCallback((content: string) => {
      const state = useStore.getState()
      const last = state.messages[state.messages.length - 1]
      if (!last || last.role !== 'assistant') {
        // Create assistant message if missing (rare race)
        const newMsg: Message = { id: genId(), role: 'assistant', content, timestamp: Date.now(), toolCalls: [] }
        state.addMessage(newMsg)
      } else {
        state.appendToLastMessage(content)
      }
      scrollToBottom()
    }, [scrollToBottom]),

    onContentSet: useCallback((content: string) => {
      const state = useStore.getState()
      const last = state.messages[state.messages.length - 1]
      if (last?.role === 'assistant') {
        state.updateMessage(last.id, { content })
      }
    }, []),

    onToolStart: useCallback((tool: string, args: Record<string, unknown>) => {
      const state = useStore.getState()
      const last = state.messages[state.messages.length - 1]
      if (!last || last.role !== 'assistant') return
      const toolCall: ToolCall = {
        id: genId(),
        name: tool,
        args,
        status: 'running',
        startedAt: Date.now(),
      }
      state.addToolCall(last.id, toolCall)
      scrollToBottom()
    }, [scrollToBottom]),

    onToolResult: useCallback((tool: string, result: unknown) => {
      const state = useStore.getState()
      const last = state.messages[state.messages.length - 1]
      if (!last?.toolCalls?.length) return
      // Find most recent running tool with same name
      const running = [...last.toolCalls].reverse().find(tc => tc.name === tool && tc.status === 'running')
      const targetId = running?.id || last.toolCalls[last.toolCalls.length - 1].id
      const isError = (result as any)?.error != null
      state.updateToolCall(last.id, targetId, {
        result,
        status: isError ? 'error' : 'done',
        durationMs: running?.startedAt ? Date.now() - running.startedAt : undefined
      })
      if (shouldRefreshFileTree(tool, result)) scheduleFileTreeRefresh()
      scrollToBottom()
    }, [scrollToBottom]),

    onApprovalNeeded: useCallback((tool: string, args: Record<string, unknown>, requestId: string, toolCallId: string) => {
      const state = useStore.getState()
      if (state.config.auto_approve) {
        ws.send({ type: 'approve', request_id: requestId, approved: true })
        // Also show tool call as running
        const last = state.messages[state.messages.length - 1]
        if (last?.role === 'assistant') {
          state.addToolCall(last.id, { id: toolCallId, name: tool, args, status: 'running', startedAt: Date.now() })
        }
      } else {
        // Show as approval_needed in timeline
        const last = state.messages[state.messages.length - 1]
        if (last?.role === 'assistant') {
          state.addToolCall(last.id, { id: toolCallId, name: tool, args, status: 'approval_needed' })
        }
        state.setPendingApproval({ toolCallId, tool, args, requestId })
      }
    }, []),

    onDone: useCallback((stats: unknown) => {
      const s = stats as { tokens?: number; duration_ms?: number; model?: string; provider?: string; tools_used?: number; iterations?: number }
      const state = useStore.getState()
      const last = state.messages[state.messages.length - 1]
      if (last?.role === 'assistant') {
        state.updateMessage(last.id, {
          stats: {
            tokens: s?.tokens || 0,
            duration_ms: s?.duration_ms || 0,
            model: (s?.model as string) || state.currentModel,
            provider: (s?.provider as string) || state.currentProvider,
            tools_used: s?.tools_used || last.toolCalls?.length || 0,
            iterations: s?.iterations,
          }
        })
        // Mark any still-running tools as done
        last.toolCalls?.forEach(tc => {
          if (tc.status === 'running') {
            state.updateToolCall(last.id, tc.id, { status: 'done' })
          }
        })
      }
      if (s?.tokens) {
        const costPer1k = findProviderModel(state.config, state.currentProvider, state.currentModel)?.cost_per_1k || 0
        const cost = (s.tokens / 1000) * costPer1k
        state.addTokensUsed(s.tokens, cost)
      }
      if (activePluginIds(state.config).includes('planner') && last?.role === 'assistant') {
        const plan = sanitizeAssistantContent(useStore.getState().messages.find((m) => m.id === last.id)?.content || last.content || '')
        void savePlanMarkdown(plan)
      }
      void refreshSessions()
      scrollToBottom()
    }, [scrollToBottom]),

    onError: useCallback((message: string) => {
      const state = useStore.getState()
      const last = state.messages[state.messages.length - 1]
      if (last?.role === 'assistant') {
        // If assistant is empty, show error inside it; otherwise append new error message
        if (!last.content && (!last.toolCalls || last.toolCalls.length === 0)) {
          state.updateMessage(last.id, { content: `**Error:** ${message}`, isError: true })
        } else {
          state.addMessage({ id: genId(), role: 'assistant', content: `**Error:** ${message}`, timestamp: Date.now(), isError: true })
        }
      } else {
        state.addMessage({ id: genId(), role: 'assistant', content: `**Error:** ${message}`, timestamp: Date.now(), isError: true })
      }
      scrollToBottom()
    }, [scrollToBottom]),
  })

  // Register send function once
  useEffect(() => {
    useStore.getState().setWsSend(ws.send)
  }, [ws.send])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return
    const state = useStore.getState()
    if (state.isStreaming) return

    let sessionId = state.currentSessionId
    if (!sessionId) {
      try {
        const preview = titleFromPrompt(content) || 'New Chat'
        const res = await fetch('http://127.0.0.1:8765/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: preview, directory: currentWorkspace() || '' }),
        })
        if (res.ok) {
          const data = await res.json()
          sessionId = data.id
          state.setCurrentSessionId(sessionId)
          await refreshSessions()
        }
      } catch (e) {
        console.error('Failed to create session:', e)
      }
    } else {
      void nameSessionFromPrompt(sessionId, content)
    }

    const userMsg: Message = { id: genId(), role: 'user', content, timestamp: Date.now() }
    state.addMessage(userMsg)

    const assistantMsg: Message = { id: genId(), role: 'assistant', content: '', timestamp: Date.now(), toolCalls: [] }
    state.addMessage(assistantMsg)
    state.setStreaming(true)

    const allMessages = useStore.getState().messages
      .filter(m => m.role !== 'system')
      .map((m, i, arr) => {
        const isLastUser = m.role === 'user' && !arr.slice(i + 1).some((x) => x.role === 'user')
        return {
          role: m.role,
          content: isLastUser ? applyActivePlugins(m.content, state.config) : m.content,
        }
      })

    const sent = ws.send({
      type: 'chat',
      messages: allMessages,
      model: state.currentModel,
      provider: state.currentProvider,
      session_id: sessionId,
      workspace: currentWorkspace() || '',
    })
    if (!sent) {
      state.updateMessage(assistantMsg.id, { content: '**Error:** Not connected. Reconnecting...', isError: true })
      state.setStreaming(false)
    }
    scrollToBottom()
  }, [ws, scrollToBottom])

  const approveTool = useCallback((approved: boolean) => {
    const state = useStore.getState()
    const approval = state.pendingApproval
    if (!approval) return
    ws.send({ type: 'approve', request_id: approval.requestId, approved })
    // Update tool status
    const last = state.messages[state.messages.length - 1]
    if (last?.toolCalls) {
      const tc = last.toolCalls.find(t => t.id === approval.toolCallId)
      if (tc) {
        state.updateToolCall(last.id, tc.id, { status: approved ? 'running' : 'error', result: approved ? undefined : { error: 'Denied by user' } as any })
      }
    }
    state.setPendingApproval(null)
  }, [ws])

  const retryLastMessage = useCallback(() => {
    const state = useStore.getState()
    const msgs = state.messages
    const lastUser = [...msgs].reverse().find(m => m.role === 'user')
    if (!lastUser) return
    // Remove last assistant + user pair
    const newMsgs = msgs.filter(m => m.id !== lastUser.id && !(m.role === 'assistant' && msgs.indexOf(m) > msgs.indexOf(lastUser)))
    // If last message is assistant after that user, remove it too
    const lastIdx = msgs.findIndex(m => m.id === lastUser.id)
    const after = msgs.slice(lastIdx + 1).filter(m => m.role === 'assistant').map(m => m.id)
    useStore.setState({ messages: msgs.filter(m => !after.includes(m.id) && m.id !== lastUser.id) })
    sendMessage(lastUser.content)
  }, [sendMessage])

  return { messages, isStreaming, sendMessage, approveTool, retryLastMessage, scrollRef, scrollToBottom }
}
