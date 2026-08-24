import { useCallback, useRef, useEffect, type UIEvent, type WheelEvent } from 'react'
import { useStore, Message, ToolCall } from '../store/store'
import { findProviderModel } from '../lib/appConfig'
import { applyActivePlugins, activePluginIds } from '../lib/plugins'
import { compactMessages, htmlUrlFromTool, messagesThroughUser } from '../lib/chatActions'
import { ASK_PROMPT, WEB_PROMPT, hasWebMention, isHtmlWriteTool, toolPath } from '../lib/qol'
import { refreshSessions, nameSessionFromPrompt, persistCurrentSession, createChatSession } from '../lib/sessions'
import { currentWorkspace, savePlanMarkdown, scheduleFileTreeRefresh } from '../lib/workspace'
import { titleFromPrompt } from '../lib/chatTitle'
import { shouldRefreshFileTree } from '../lib/fileTreeSync'
import { sanitizeAssistantContent } from '../lib/sanitizeAssistantContent'
import { mergeReasoning, splitThinkTags } from '../lib/thinking'
import { swarmWorkersFromArgs } from '../lib/swarm'
import { useWebSocket } from './useWebSocket'

function genId(): string {
  return Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 6)
}

export function useChat() {
  const messages = useStore((s) => s.messages)
  const isStreaming = useStore((s) => s.isStreaming)
  const queuedMessage = useStore((s) => s.queuedMessage)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sendMessageRef = useRef<(content: string) => Promise<void>>(async () => {})
  const stickToBottom = useRef(true)
  const lastScrollTop = useRef(0)
  const scrollQueued = useRef(false)

  const scrollToBottom = useCallback((force = false) => {
    if (force) stickToBottom.current = true
    if (!force && !stickToBottom.current) return
    if (scrollQueued.current) return
    scrollQueued.current = true
    requestAnimationFrame(() => {
      scrollQueued.current = false
      const el = scrollRef.current
      if (!el) return
      if (!stickToBottom.current) return
      el.scrollTop = el.scrollHeight
      lastScrollTop.current = el.scrollTop
    })
  }, [])

  const onChatScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    const top = el.scrollTop
    if (top + 2 < lastScrollTop.current) {
      stickToBottom.current = false
    } else {
      stickToBottom.current = el.scrollHeight - top - el.clientHeight <= 96
    }
    lastScrollTop.current = top
  }, [])

  const onChatWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) stickToBottom.current = false
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

    onReasoning: useCallback((content: string) => {
      const state = useStore.getState()
      const last = state.messages[state.messages.length - 1]
      if (!last || last.role !== 'assistant') {
        state.addMessage({ id: genId(), role: 'assistant', content: '', reasoning: content, timestamp: Date.now(), toolCalls: [] })
      } else {
        state.appendToLastReasoning(content)
      }
      scrollToBottom()
    }, [scrollToBottom]),

    onContentSet: useCallback((content: string) => {
      const state = useStore.getState()
      const last = state.messages[state.messages.length - 1]
      if (last?.role === 'assistant') {
        const split = splitThinkTags(content)
        state.updateMessage(last.id, {
          content: split.content,
          reasoning: mergeReasoning(last.reasoning, split.reasoning),
        })
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
      if (tool === 'spawn_swarm') {
        const workers = swarmWorkersFromArgs(args)
        if (workers.length) state.startSwarm({ goal: String(args.goal || ''), workers })
      }
      const path = toolPath(args)
      state.setAgentStep(path ? `${tool} ${path}` : tool)
      const root = currentWorkspace()
      if ((tool === 'write_file' || tool === 'edit_file') && path) {
        void fetch('http://127.0.0.1:8765/files/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, root: root || undefined }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            useStore.getState().setUndoWrite({
              path,
              content: typeof data?.content === 'string' ? data.content : '',
              root,
            })
          })
          .catch(() => {
            useStore.getState().setUndoWrite({ path, content: '', root })
          })
      }
      const htmlUrl = htmlUrlFromTool(tool, args, root)
      if (htmlUrl) {
        const name = String(args.path || args.file || htmlUrl).replace(/\\/g, '/').split('/').pop() || 'page'
        state.setPreviewOffer({ url: htmlUrl, label: name })
      }
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
      if (tool === 'spawn_swarm' && result && typeof result === 'object') {
        const agents = (result as { agents?: Array<{ id?: string; result?: string; error?: string; tools_used?: number }> }).agents
        if (Array.isArray(agents)) {
          agents.forEach((agent, i) => {
            const id = agent.id || `s${i}`
            useStore.getState().setSwarmWorker(id, {
              ...(agent.result ? { content: agent.result } : {}),
              ...(agent.error ? { error: agent.error, status: 'error' as const } : { status: 'done' as const }),
              toolsUsed: agent.tools_used,
            })
          })
          useStore.getState().endSwarm()
        }
      }
      if (!isError && isHtmlWriteTool(tool, running?.args || last.toolCalls.find((t) => t.id === targetId)?.args)) {
        const htmlUrl = htmlUrlFromTool(tool, running?.args || {}, currentWorkspace())
        if (htmlUrl) {
          if (state.browserOpen && state.browserUrl === htmlUrl) state.bumpBrowser()
          else state.openInBrowser(htmlUrl)
        }
      }
      const still = useStore.getState().messages.at(-1)?.toolCalls?.some((t) => t.status === 'running')
      if (!still) useStore.getState().setAgentStep(null)
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
      useStore.getState().setAgentStep(null)
      if (useStore.getState().swarm?.active) useStore.getState().endSwarm()
      void persistCurrentSession()
      void refreshSessions()
      scrollToBottom()
      const cancelled = Boolean((stats as { cancelled?: boolean })?.cancelled)
      if (!cancelled && (document.hidden || !document.hasFocus())) {
        const preview = sanitizeAssistantContent(last?.content || '').replace(/\s+/g, ' ').trim().slice(0, 140)
        void window.api?.app?.notifyDone?.({
          title: 'Nexum',
          body: preview || 'Agent finished',
        })
      }
      const queued = useStore.getState().queuedMessage
      if (queued) {
        useStore.getState().setQueuedMessage(null)
        queueMicrotask(() => { void sendMessageRef.current(queued) })
      }
    }, [scrollToBottom]),

    onSwarmStart: useCallback((goal: string, workers: { id: string; role: string; task: string }[]) => {
      if (workers.length) useStore.getState().startSwarm({ goal, workers })
    }, []),

    onSwarmToken: useCallback((id: string, content: string) => {
      useStore.getState().appendSwarmToken(id, content)
    }, []),

    onSwarmTool: useCallback((id: string, tool: string, extra?: { path?: string; added?: number; removed?: number }) => {
      const state = useStore.getState()
      const worker = state.swarm?.workers.find((w) => w.id === id)
      state.setSwarmWorker(id, {
        lastTool: tool,
        lastPath: extra?.path || worker?.lastPath,
        added: (worker?.added || 0) + (extra?.added || 0),
        removed: (worker?.removed || 0) + (extra?.removed || 0),
        status: 'running',
      })
      if (shouldRefreshFileTree(tool)) scheduleFileTreeRefresh()
    }, []),

    onSwarmDone: useCallback((id: string, payload: { result?: string; error?: string; tools_used?: number }) => {
      const updates: { status: 'done' | 'error'; toolsUsed?: number; error?: string; content?: string } = {
        status: payload.error ? 'error' : 'done',
        toolsUsed: payload.tools_used,
      }
      if (payload.error) updates.error = payload.error
      if (payload.result) updates.content = payload.result
      useStore.getState().setSwarmWorker(id, updates)
    }, []),

    onSwarmEnd: useCallback(() => {
      useStore.getState().endSwarm()
    }, []),

    onError: useCallback((message: string) => {
      const state = useStore.getState()
      const last = state.messages[state.messages.length - 1]
      if (last?.role === 'assistant') {
        // If assistant is empty, show error inside it; otherwise append new error message
        if (!last.content && !last.reasoning && (!last.toolCalls || last.toolCalls.length === 0)) {
          state.updateMessage(last.id, { content: `**Error:** ${message}`, isError: true })
        } else {
          state.addMessage({ id: genId(), role: 'assistant', content: `**Error:** ${message}`, timestamp: Date.now(), isError: true })
        }
      } else {
        state.addMessage({ id: genId(), role: 'assistant', content: `**Error:** ${message}`, timestamp: Date.now(), isError: true })
      }
      state.pushToast({ kind: 'error', text: message })
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
    if (state.isStreaming) {
      state.setQueuedMessage(content.trim())
      return
    }
    if (state.messages.length > 0) state.addCheckpoint()
    if (!state.swarm?.active) state.clearSwarm()

    let sessionId = state.currentSessionId
    if (!sessionId) {
      sessionId = await createChatSession(titleFromPrompt(content) || 'New Chat')
      if (sessionId) {
        state.setCurrentSessionId(sessionId)
        await refreshSessions()
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
        let text = isLastUser ? applyActivePlugins(m.content, state.config) : m.content
        if (isLastUser && hasWebMention(m.content)) text = `${WEB_PROMPT}\n\n${text}`
        if (isLastUser && state.config.agent_mode === 'ask') text = `${ASK_PROMPT}\n\n${text}`
        return { role: m.role, content: text }
      })

    const sent = ws.send({
      type: 'chat',
      messages: allMessages,
      model: state.currentModel,
      provider: state.currentProvider,
      session_id: sessionId,
      workspace: currentWorkspace() || '',
      api_key: state.config.providers[state.currentProvider]?.api_key || '',
    })
    if (!sent) {
      state.updateMessage(assistantMsg.id, { content: '**Error:** Not connected. Reconnecting...', isError: true })
      state.setStreaming(false)
      state.pushToast({ kind: 'error', text: 'Backend is disconnected. Retrying…' })
    }
    void persistCurrentSession()
    scrollToBottom(true)
  }, [ws, scrollToBottom])

  sendMessageRef.current = sendMessage

  const stopGeneration = useCallback(() => {
    ws.send({ type: 'cancel' })
  }, [ws])

  const editAndResend = useCallback((userId: string, content: string) => {
    const state = useStore.getState()
    useStore.setState({ messages: messagesThroughUser(state.messages, userId) })
    if (state.isStreaming) {
      stopGeneration()
      state.setQueuedMessage(content)
      return
    }
    void sendMessage(content)
  }, [sendMessage, stopGeneration])

  const compactChat = useCallback(() => {
    const state = useStore.getState()
    if (state.isStreaming) return
    useStore.setState({ messages: compactMessages(state.messages) })
  }, [])

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

  const continueChat = useCallback(() => {
    void sendMessage('Continue from where you left off and finish the task.')
  }, [sendMessage])

  return {
    messages,
    isStreaming,
    queuedMessage,
    sendMessage,
    continueChat,
    stopGeneration,
    editAndResend,
    compactChat,
    approveTool,
    retryLastMessage,
    reconnect: ws.connect,
    scrollRef,
    scrollToBottom,
    onChatScroll,
    onChatWheel,
  }
}
