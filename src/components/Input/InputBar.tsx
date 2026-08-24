import { apiFetch } from '../../lib/api'
import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { useStore } from '../../store/store'
import CommandMenu from './CommandMenu'
import FileMentionMenu from './FileMentionMenu'
import { persistConfig } from '../../lib/appConfig'
import { projectPathFromDrop } from '../../lib/chatActions'
import { PLUGIN_CATALOG_MAP, pluginByCommand } from '../../lib/pluginCatalog'
import { pushPromptHistory, speechSupported } from '../../lib/qol'
import { addFileToChat } from '../../lib/workspaceFiles'
import { activePluginIds, handlePluginSlash, setPluginActive, slashPluginCommands } from '../../lib/plugins'
import { ensurePlanFile, setChatDirectory } from '../../lib/workspace'
import { openBrickPong } from '../../lib/brickPong'

interface Props {
  onSend: (content: string) => void
  onStop?: () => void
  onCompact?: () => void
  isStreaming: boolean
}

const MAX_ATTACH_SIZE = 2_000_000 // 2MB
const HISTORY_KEY = 'nx-prompt-history'

function readPromptHistory(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

type SpeechRec = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export default function InputBar({ onSend, onStop, onCompact, isStreaming }: Props) {
  const [value, setValue] = useState('')
  const [showCommands, setShowCommands] = useState(false)
  const [showFileMention, setShowFileMention] = useState(false)
  const [fileMentionQuery, setFileMentionQuery] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string }[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [pluginNotice, setPluginNotice] = useState('')
  const autoApprove = useStore((s) => s.config.auto_approve)
  const setConfig = useStore((s) => s.setConfig)
  const currentModel = useStore((s) => s.currentModel)
  const currentProvider = useStore((s) => s.currentProvider)
  const config = useStore((s) => s.config)
  const queuedMessage = useStore((s) => s.queuedMessage)
  const previewOffer = useStore((s) => s.previewOffer)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRec | null>(null)
  const voiceBaseRef = useRef('')
  const historyIndex = useRef(-1)
  const draftBeforeHistory = useRef('')
  const canVoice = speechSupported()

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 48), 200)}px`
    }
  }, [value])

  useEffect(() => () => {
    recRef.current?.stop()
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) {
        setValue(detail)
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
    }
    document.addEventListener('send-message', handler)
    return () => document.removeEventListener('send-message', handler)
  }, [])

  const handleChange = useCallback((v: string) => {
    setValue(v)
    const pos = textareaRef.current?.selectionStart ?? v.length
    setCursorPos(pos)

    if (v.startsWith('/') && v.length < 30 && !v.includes(' ')) {
      setShowCommands(true)
      setShowFileMention(false)
      return
    }

    const atPos = v.lastIndexOf('@', pos - 1)
    if (atPos >= 0 && (atPos === 0 || /[\s\n]/.test(v[atPos - 1]))) {
      const query = v.substring(atPos + 1, pos)
      if (!query.includes(' ') && query.length < 30) {
        setFileMentionQuery(query)
        setShowFileMention(true)
        setShowCommands(false)
        return
      }
    }
    setShowCommands(false)
    setShowFileMention(false)
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands || showFileMention) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
        if (e.key === 'Escape') {
          setShowCommands(false)
          setShowFileMention(false)
        }
        // Let menus handle navigation via window listener
        if (e.key === 'Enter' && (showCommands || showFileMention)) return
      }
    }
    if (!showCommands && !showFileMention && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const ta = textareaRef.current
      const atStart = !!ta && ta.selectionStart === 0 && ta.selectionEnd === 0
      const atEnd = !!ta && ta.selectionStart === value.length && ta.selectionEnd === value.length
      if (e.key === 'ArrowUp' && (atStart || !value.trim())) {
        e.preventDefault()
        const hist = readPromptHistory()
        if (!hist.length) return
        if (historyIndex.current === -1) draftBeforeHistory.current = value
        const next = Math.min(hist.length - 1, historyIndex.current + 1)
        historyIndex.current = next
        handleChange(hist[next])
        return
      }
      if (e.key === 'ArrowDown' && historyIndex.current >= 0 && (atEnd || true)) {
        e.preventDefault()
        const next = historyIndex.current - 1
        historyIndex.current = next
        handleChange(next < 0 ? draftBeforeHistory.current : readPromptHistory()[next])
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setShowCommands(false)
      setShowFileMention(false)
      if (listening) recRef.current?.stop()
    }
  }

  const canSend = !!value.trim() || attachedFiles.length > 0

  const handleSend = () => {
    if (!canSend) return
    let message = value
    if (message.trim().startsWith('/')) {
      if (/^\/pong\b/i.test(message.trim())) {
        openBrickPong()
        setValue('')
        setShowCommands(false)
        setPluginNotice('Brick Pong — drag the window, yellow to minimize')
        return
      }
      const { result, config: next } = handlePluginSlash(message, useStore.getState().config)
      if (result.kind !== 'ignore') {
        setConfig(next)
        persistConfig(next)
        setShowCommands(false)
        if (result.kind === 'consumed') {
          setValue('')
          setPluginNotice(result.notice)
          return
        }
        message = result.text
      }
    }
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles.map(f => `[File: ${f.name}]\n${f.content.slice(0, 15000)}`).join('\n\n')
      message = message ? `${message}\n\n${fileContext}` : fileContext
    }
    if (!message.trim()) return
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(pushPromptHistory(readPromptHistory(), message)))
    } catch {
      /* ignore */
    }
    historyIndex.current = -1
    onSend(message)
    setValue('')
    setAttachedFiles([])
    setShowCommands(false)
    setShowFileMention(false)
    setPluginNotice('')
  }

  const toggleVoice = () => {
    if (!canVoice) {
      useStore.getState().pushToast({ kind: 'error', text: 'Voice input is not available in this window.' })
      return
    }
    if (listening) {
      recRef.current?.stop()
      return
    }
    const w = window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = navigator.language || 'en-US'
    voiceBaseRef.current = value
    rec.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript
      const base = voiceBaseRef.current
      handleChange(base ? `${base}${base.endsWith(' ') ? '' : ' '}${text}` : text)
    }
    rec.onerror = () => {
      setListening(false)
      useStore.getState().pushToast({ kind: 'error', text: 'Could not hear you. Try again.' })
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
      useStore.getState().pushToast({ kind: 'error', text: 'Microphone could not start.' })
    }
  }

  const processFile = (file: File) => {
    if (file.size > MAX_ATTACH_SIZE) {
      // For large files, just send name + truncated preview
      const reader = new FileReader()
      reader.onload = (ev) => {
        const content = (ev.target?.result as string).slice(0, 15000)
        setAttachedFiles(prev => [...prev, { name: file.name, content: `[Large file ${file.size} bytes, preview]:\n${content}` }])
      }
      reader.readAsText(file.slice(0, 50000))
      return
    }
    // Check if text file
    const isText = file.type.startsWith('text/') || /\.(txt|js|ts|tsx|jsx|py|json|md|css|html|yaml|yml|toml|xml|sh|zsh|bash|sql|cfg|ini|env|log|csv|rs|go|java|c|cpp|h)$/.test(file.name)
    if (!isText && file.type.startsWith('image/')) {
      // For images, note that model may not support vision - include as placeholder
      setAttachedFiles(prev => [...prev, { name: file.name, content: `[Image: ${file.name} - ${file.type} ${file.size} bytes. Note: vision not yet supported, please describe the image.]` }])
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setAttachedFiles(prev => [...prev, { name: file.name, content: content.slice(0, 15000) }])
    }
    reader.onerror = () => {}
    reader.readAsText(file)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(processFile)
    e.target.value = ''
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          setAttachedFiles(prev => [...prev, { name: file.name || 'pasted-image.png', content: `[Pasted image: ${file.name || 'image'} - vision not yet supported]` }])
        }
        break
      }
    }
  }, [])

  const removeAttached = (idx: number) => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const droppedPath = e.dataTransfer.getData('application/x-nexum-path') || e.dataTransfer.getData('text/plain')
    if (droppedPath && !e.dataTransfer.files.length) {
      addFileToChat(droppedPath)
      return
    }
    const files = e.dataTransfer.files
    if (!files?.length) return
    const folder = projectPathFromDrop(Array.from(files).map((file) => ({
      path: (file as File & { path?: string }).path,
      name: file.name,
    })))
    const first = files[0] as File & { path?: string }
    const looksFolder = !!first?.path && !/\.[a-z0-9]{1,10}$/i.test(first.name)
    if (looksFolder && folder) {
      void setChatDirectory(folder)
      return
    }
    Array.from(files).forEach(processFile)
  }

  const handleCommandSelect = async (command: string) => {
    setShowCommands(false)
    if (command === '/pong') {
      openBrickPong()
      setPluginNotice('Brick Pong — drag the window, yellow to minimize')
    } else if (command === '/clear') {
      useStore.getState().clearMessages()
    } else if (command === '/compact') {
      if (onCompact) onCompact()
      else onSend('Summarize our conversation so far, keeping key context for continuing.')
    } else if (command === '/cost') {
      const s = useStore.getState()
      onSend(`Token usage: ${s.totalTokensUsed} total. Model ${s.currentModel} on ${s.currentProvider}.`)
    } else if (command === '/help') {
      const extras = slashPluginCommands().map((c) => c.name)
      const cmds = ['/clear', '/compact', '/cost', '/help', '/image', '/web', ...extras, '@files', '@web'].join(', ')
      onSend(`Show available commands: ${cmds}. Install more from Settings → Plugins.`)
    } else if (command === '/web') {
      setValue('@web ')
      textareaRef.current?.focus()
    } else if (command === '/new') {
      useStore.getState().clearMessages()
      useStore.getState().setCurrentSessionId(null)
    } else if (pluginByCommand(command)) {
      const plugin = pluginByCommand(command)
      const { result, config: next } = handlePluginSlash(command, useStore.getState().config)
      if (plugin?.id === 'planner' && (next.active_plugins || []).includes('planner')) {
        const path = await ensurePlanFile()
        if (!path) {
          setPluginNotice('Pick a project folder to save plan.md')
          return
        }
      }
      setConfig(next)
      persistConfig(next)
      if (result.kind === 'consumed') setPluginNotice(result.notice)
      else setValue(command + ' ')
    } else {
      setValue(command + ' ')
      textareaRef.current?.focus()
    }
  }

  const handleFileSelect = (filePath: string) => {
    const ta = textareaRef.current
    const pos = ta?.selectionStart ?? cursorPos
    const before = value.substring(0, pos)
    const after = value.substring(pos)
    const atPos = before.lastIndexOf('@')
    if (atPos === -1) {
      setValue(value + filePath + ' ')
    } else {
      const newValue = before.substring(0, atPos) + filePath + ' ' + after
      setValue(newValue)
      const newPos = atPos + filePath.length + 1
      setTimeout(() => {
        if (ta) { ta.selectionStart = newPos; ta.selectionEnd = newPos; ta.focus() }
      }, 0)
    }
    setShowFileMention(false)
  }

  const toggleAutoApprove = async () => {
    const cfg = useStore.getState().config
    const next = { ...cfg, auto_approve: !autoApprove }
    setConfig(next)
    // Persist to backend
    try {
      await apiFetch('http://127.0.0.1:8765/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      })
    } catch {}
  }

  return (
    <div className="bg-surface-0 px-4 pt-3 pb-3 shrink-0 min-w-0 overflow-visible">
      <div className="composer-col relative z-20">
        {showCommands && (
          <CommandMenu
            filter={value.slice(1)}
            pluginCommands={slashPluginCommands()}
            onSelect={handleCommandSelect}
            onClose={() => setShowCommands(false)}
          />
        )}
        {showFileMention && (
          <FileMentionMenu query={fileMentionQuery} onSelect={handleFileSelect} onClose={() => setShowFileMention(false)} />
        )}

        {previewOffer && (
          <div className="flex items-center justify-center gap-2 mb-2 animate-fade-in">
            <button
              onClick={() => useStore.getState().openInBrowser(previewOffer.url)}
              className="h-7 px-2.5 rounded-md border border-border bg-surface-2 text-[12px] text-text-secondary hover:text-text-primary"
            >
              Open {previewOffer.label} in browser
            </button>
            <button
              onClick={() => useStore.getState().setPreviewOffer(null)}
              className="h-7 px-2 rounded-md text-[11px] text-text-muted hover:text-text-primary"
            >
              Dismiss
            </button>
          </div>
        )}
        {queuedMessage && (
          <div className="flex items-center justify-center gap-2 mb-2 text-[12px] text-text-secondary animate-fade-in">
            <span className="truncate max-w-[28rem]">Queued: {queuedMessage}</span>
            <button
              onClick={() => useStore.getState().setQueuedMessage(null)}
              className="h-6 px-2 rounded-md text-[11px] text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          </div>
        )}
        {(activePluginIds(config).length > 0 || pluginNotice) && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2 min-h-6">
            {activePluginIds(config).map((id) => (
              <button
                key={id}
                onClick={() => {
                  const next = setPluginActive(config, id, false)
                  setConfig(next)
                  persistConfig(next)
                }}
                className="h-6 px-2.5 rounded-md border border-border bg-surface-2 text-[11px] leading-6 text-text-secondary hover:text-text-primary"
              >
                {PLUGIN_CATALOG_MAP[id]?.name || id} · on
              </button>
            ))}
            {pluginNotice && <span className="text-[11px] leading-6 text-text-muted">{pluginNotice}</span>}
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-2.5">
            {attachedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-xs text-text-secondary max-w-[240px]">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent shrink-0"><path d="M7 1H3a1 1 0 00-1 1v8a1 1 0 001 1h6a1 1 0 001-1V4L7 1z" stroke="currentColor" strokeWidth="1" /></svg>
                <span className="truncate flex-1">{file.name}</span>
                <button onClick={() => removeAttached(i)} className="p-0.5 rounded hover:bg-surface-3 text-text-muted hover:text-danger transition-smooth">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`composer-shell flex flex-nowrap items-end min-h-12 min-w-0 bg-surface-1 rounded-2xl border ${isDragging ? 'border-accent' : 'border-border'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={attachedFiles.length > 0 ? `${attachedFiles.length} file(s) attached — add a message…` : "Ask anything… (@ files, / commands)"}
            rows={1}
            className="flex-1 min-w-0 bg-transparent px-4 text-[14px] leading-6 text-text-primary resize-none focus:outline-none placeholder:text-text-muted min-h-12 max-h-[200px] py-3 box-border"
          />

          <div className="flex flex-nowrap items-center justify-end gap-0.5 pr-2 pl-1 h-12 shrink-0">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept=".txt,.js,.ts,.tsx,.jsx,.py,.rs,.go,.java,.c,.cpp,.h,.css,.html,.json,.yaml,.yml,.md,.sh,.zsh,.bash,.sql,.xml,.toml,.cfg,.ini,.env,.log,.csv" />
            <button onClick={() => fileInputRef.current?.click()} className="h-7 w-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-smooth" title="Attach files">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13 7l-5 5a3 3 0 01-4.24-4.24l5-5A2 2 0 0111 4.5l-5 5a1 1 0 01-1.42-1.42l5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button
              onClick={toggleVoice}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition-smooth ${
                listening
                  ? 'bg-danger/15 text-danger'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
              title={listening ? 'Stop listening' : canVoice ? 'Voice input' : 'Voice input is unavailable'}
              aria-label={listening ? 'Stop voice input' : 'Voice input'}
              aria-pressed={listening}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="6" y="2" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4 8a4 4 0 008 0M8 12v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            <button onClick={toggleAutoApprove} className={`h-7 px-2 text-[11px] rounded-lg transition-smooth inline-flex items-center gap-1 shrink-0 whitespace-nowrap ${autoApprove ? 'text-success' : 'text-text-muted hover:text-text-primary hover:bg-surface-2'}`} title="Auto-approve tool execution">
              Auto {autoApprove && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>

            {isStreaming && (
              <button
                onClick={onStop}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-smooth"
                aria-label="Stop"
                title="Stop generation (Esc)"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /></svg>
              </button>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-25 disabled:cursor-not-allowed transition-smooth text-accent-ink"
              aria-label={isStreaming ? 'Queue' : 'Send'}
              title={isStreaming ? 'Queue next message' : 'Send'}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 7l8-4v8L3 7z" fill="currentColor" /></svg>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center mt-2 h-5 text-[11px] leading-5 text-text-muted overflow-hidden">
          {isDragging ? (
            <span className="text-text-secondary truncate">Drop files to attach</span>
          ) : (
            <span className="truncate">{listening ? 'Listening… click the mic to stop' : isStreaming ? 'Enter queues the next message · Esc stops' : 'Enter to send · ↑↓ prompt history · mic to talk'}</span>
          )}
        </div>
      </div>
    </div>
  )
}
