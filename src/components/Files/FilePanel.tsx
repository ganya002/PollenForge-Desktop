import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useStore } from '../../store/store'
import MarkdownRenderer from '../Chat/MarkdownRenderer'
import { FileTypeIcon } from '../Sidebar/fileIcons'
import { addFileToChat } from '../../lib/workspaceFiles'

const LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'html',
  htm: 'html',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sql: 'sql',
  xml: 'xml',
  svg: 'xml',
}

function langFor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return LANG[ext] || 'text'
}

export default function FilePanel() {
  const openFiles = useStore((s) => s.openFiles)
  const activeFilePath = useStore((s) => s.activeFilePath)
  const closeFile = useStore((s) => s.closeFile)
  const setActiveFile = useStore((s) => s.setActiveFile)
  const [source, setSource] = useState(false)

  const active = openFiles.find((f) => f.path === activeFilePath) || openFiles[0]
  if (!active) return null
  const isMd = /\.mdx?$/i.test(active.name)

  return (
    <div className="h-full min-h-0 w-[min(28rem,42%)] shrink-0 border-l border-border bg-surface-0 flex flex-col">
      <div className="h-10 shrink-0 flex items-center gap-1 px-1 border-b border-border overflow-x-auto">
        {openFiles.map((file) => {
          const on = file.path === active.path
          return (
            <button
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              className={`h-8 max-w-[10rem] shrink-0 px-2 rounded-md text-[12px] inline-flex items-center gap-1.5 ${
                on ? 'bg-surface-2 text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
              title={file.path}
            >
              <FileTypeIcon name={file.name} isDirectory={false} />
              <span className="truncate">{file.name}</span>
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation()
                  closeFile(file.path)
                }}
                className="ml-0.5 w-4 h-4 rounded hover:bg-surface-3 inline-flex items-center justify-center text-text-muted"
              >
                ×
              </span>
            </button>
          )
        })}
      </div>

      <div className="h-8 shrink-0 px-3 border-b border-border flex items-center gap-2 text-[11px] text-text-muted">
        <span className="truncate flex-1 font-mono" title={active.path}>{active.path}</span>
        {isMd && (
          <button
            onClick={() => setSource((v) => !v)}
            className="h-6 px-2 rounded-md border border-border hover:text-text-primary"
          >
            {source ? 'Preview' : 'Source'}
          </button>
        )}
        <button
          onClick={() => addFileToChat(active.path)}
          className="h-6 px-2 rounded-md border border-border hover:text-text-primary"
        >
          Add to chat
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {active.error ? (
          <p className="p-4 text-[13px] text-danger">{active.error}</p>
        ) : isMd && !source ? (
          <div className="p-4 markdown-body text-[13px] leading-relaxed">
            <MarkdownRenderer content={active.content} />
          </div>
        ) : (
          <SyntaxHighlighter
            language={langFor(active.name)}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: '12px 14px',
              background: 'transparent',
              fontSize: '12px',
              lineHeight: '1.55',
              minHeight: '100%',
            }}
            wrapLongLines
            showLineNumbers
          >
            {active.content || ' '}
          </SyntaxHighlighter>
        )}
        {active.truncated && (
          <p className="px-4 py-2 text-[11px] text-text-muted border-t border-border">File truncated for preview.</p>
        )}
      </div>
    </div>
  )
}
