import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { useStore } from '../../store/store'
import CommandMenu from './CommandMenu'
import FileMentionMenu from './FileMentionMenu'

interface Props { onSend: (content: string) => void; isStreaming: boolean }

const MAX_ATTACH_SIZE = 2_000_000 // 2MB

export default function InputBar({ onSend, isStreaming }: Props) {
  const [value, setValue] = useState('')
  const [showCommands, setShowCommands] = useState(false)
  const [showFileMention, setShowFileMention] = useState(false)
  const [fileMentionQuery, setFileMentionQuery] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string }[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const autoApprove = useStore((s) => s.config.auto_approve)
  const setConfig = useStore((s) => s.setConfig)
  const currentModel = useStore((s) => s.currentModel)
  const currentProvider = useStore((s) => s.currentProvider)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
    }
  }, [value])

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setShowCommands(false)
      setShowFileMention(false)
    }
  }

  const canSend = (!!value.trim() || attachedFiles.length > 0) && !isStreaming

  const handleSend = () => {
    if (!canSend) return
    let message = value
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles.map(f => `[File: ${f.name}]\n${f.content.slice(0, 15000)}`).join('\n\n')
      message = message ? `${message}\n\n${fileContext}` : fileContext
    }
    onSend(message)
    setValue('')
    setAttachedFiles([])
    setShowCommands(false)
    setShowFileMention(false)
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
    const files = e.dataTransfer.files
    if (!files) return
    Array.from(files).forEach(processFile)
  }

  const handleCommandSelect = (command: string) => {
    setShowCommands(false)
    if (command === '/clear') {
      useStore.getState().clearMessages()
    } else if (command === '/compact') {
      onSend('Summarize our conversation so far, keeping key context for continuing.')
    } else if (command === '/cost') {
      const s = useStore.getState()
      onSend(`Token usage: ${s.totalTokensUsed} total. Model ${s.currentModel} on ${s.currentProvider}.`)
    } else if (command === '/help') {
      onSend('Show available commands: /clear, /compact, /cost, /help, @files, and all tools like git, run_command, etc')
    } else if (command === '/new') {
      useStore.getState().clearMessages()
      useStore.getState().setCurrentSessionId(null)
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
      await fetch('http://127.0.0.1:8765/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      })
    } catch {}
  }

  return (
    <div className="border-t border-border/60 bg-surface-1 p-3">
      <div className="max-w-4xl mx-auto relative">
        {showCommands && (
          <CommandMenu filter={value.slice(1)} onSelect={handleCommandSelect} onClose={() => setShowCommands(false)} />
        )}
        {showFileMention && (
          <FileMentionMenu query={fileMentionQuery} onSelect={handleFileSelect} onClose={() => setShowFileMention(false)} />
        )}

        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
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

        <div
          className={`flex items-end gap-2 bg-surface-0 rounded-2xl border shadow-sm transition-smooth ${isDragging ? 'border-accent bg-accent-muted/10' : 'border-border focus-within:border-accent/50 focus-within:shadow-md'}`}
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
            className="flex-1 bg-transparent px-4 py-3.5 text-[14px] leading-relaxed text-text-primary resize-none focus:outline-none placeholder:text-text-muted min-h-[52px] max-h-[200px]"
          />

          <div className="flex items-center gap-1 pr-2 pb-2 shrink-0">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept=".txt,.js,.ts,.tsx,.jsx,.py,.rs,.go,.java,.c,.cpp,.h,.css,.html,.json,.yaml,.yml,.md,.sh,.zsh,.bash,.sql,.xml,.toml,.cfg,.ini,.env,.log,.csv" />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text-primary transition-smooth" title="Attach files">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 7l-5 5a3 3 0 01-4.24-4.24l5-5A2 2 0 0111 4.5l-5 5a1 1 0 01-1.42-1.42l5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>

            <button onClick={toggleAutoApprove} className={`px-2.5 py-1.5 text-[11px] font-medium rounded-xl border transition-smooth inline-flex items-center gap-1 ${autoApprove ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-surface-2 text-text-muted border-border hover:text-text-primary'}`} title="Auto-approve tool execution (like Codex --yolo)">
              Auto {autoApprove && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>

            <button
              onClick={handleSend}
              disabled={!canSend}
              className="p-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition-smooth text-white shadow-sm"
              aria-label={isStreaming ? 'Stop' : 'Send'}
            >
              {isStreaming ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l8-4v8L3 7z" fill="currentColor" /></svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shadow-sm" style={{ background: ({ pollinations: '#ff3b30', openai: '#00c950', anthropic: '#ff7a00', google: '#0091ff', ollama: '#ffcc00', openrouter: '#00e6ff' } as any)[currentProvider] || '#f0f0f0' }} />
              {currentModel}
            </span>
            <span className="opacity-50">·</span>
            <span>{currentProvider}</span>
            {isDragging && <span className="text-accent">Drop files to attach</span>}
          </div>
          <div className="text-[10px] text-text-muted hidden sm:block">
            <span className="hidden md:inline">Enter to send · Shift+Enter for newline · / commands · @ files</span>
          </div>
        </div>
      </div>
    </div>
  )
}
