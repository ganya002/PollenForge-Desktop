import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/store'
import { backendToken } from '../lib/api'

type WSMessage =
  | { type: 'token'; content: string }
  | { type: 'content_set'; content: string }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown>; request_id?: string }
  | { type: 'tool_result'; tool: string; result: unknown }
  | { type: 'approval_needed'; tool: string; args: Record<string, unknown>; request_id: string; tool_call_id: string }
  | { type: 'progress'; iteration: number; max_iterations: number; tools_executed: number }
  | { type: 'done'; stats: unknown }
  | { type: 'error'; message: string }
  | { type: 'pong' }

interface UseWebSocketOptions {
  onToken?: (content: string) => void
  onContentSet?: (content: string) => void
  onToolStart?: (tool: string, args: Record<string, unknown>) => void
  onToolResult?: (tool: string, result: unknown) => void
  onApprovalNeeded?: (tool: string, args: Record<string, unknown>, requestId: string, toolCallId: string) => void
  onProgress?: (iteration: number, maxIterations: number, toolsExecuted: number) => void
  onDone?: (stats: unknown) => void
  onError?: (message: string) => void
}

const WS_URL = 'ws://127.0.0.1:8765/ws'
const PING_INTERVAL = 30000

export function useWebSocket(options: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const optionsRef = useRef(options)
  const shouldReconnect = useRef(true)
  const setStreaming = useStore((s) => s.setStreaming)
  const setWsConnected = useStore((s) => s.setWsConnected)

  optionsRef.current = options

  const cleanupTimers = useCallback(() => {
    if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null }
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null }
  }, [])

  const connect = useCallback(() => {
    const existing = wsRef.current
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return

    // T1: browsers cannot set custom headers on WebSocket -> token rides in
    // the query string. Fetched once via IPC, cached in lib/api.
    void backendToken().then((token) => {
      if (!shouldReconnect.current) return
      const ws = new WebSocket(
        token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL,
      )
      wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'ping' })) } catch {}
        }
      }, PING_INTERVAL)
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        const opts = optionsRef.current
        switch (msg.type) {
          case 'token': opts.onToken?.(msg.content); break
          case 'content_set': opts.onContentSet?.(msg.content); break
          case 'tool_start': opts.onToolStart?.(msg.tool, msg.args); break
          case 'tool_result': opts.onToolResult?.(msg.tool, msg.result); break
          case 'approval_needed': opts.onApprovalNeeded?.(msg.tool, msg.args, msg.request_id, msg.tool_call_id); break
          case 'progress': opts.onProgress?.(msg.iteration, msg.max_iterations, msg.tools_executed); break
          case 'done': opts.onDone?.(msg.stats); setStreaming(false); break
          case 'error': opts.onError?.(msg.message); setStreaming(false); break
          case 'pong': break
        }
      } catch {
        console.error('[WS] Failed to parse message:', event.data?.slice?.(0, 200))
      }
    }

    ws.onclose = () => {
      setWsConnected(false)
      cleanupTimers()
      if (shouldReconnect.current) {
        const delay = 1000 + Math.random() * 2000
        reconnectTimer.current = setTimeout(connect, delay)
      }
    }

      ws.onerror = () => {
        setWsConnected(false)
        try { ws.close() } catch {}
      }
    })
  }, [setStreaming, setWsConnected, cleanupTimers])

  const send = useCallback((data: Record<string, unknown>) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
      return true
    }
    console.warn('[WS] Not connected, dropping message:', data.type)
    return false
  }, [])

  const disconnect = useCallback(() => {
    shouldReconnect.current = false
    cleanupTimers()
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setWsConnected(false)
  }, [cleanupTimers, setWsConnected])

  useEffect(() => {
    shouldReconnect.current = true
    connect()
    return () => {
      shouldReconnect.current = false
      cleanupTimers()
      try { wsRef.current?.close() } catch {}
    }
  }, [connect, cleanupTimers])

  return { send, disconnect, connect }
}
