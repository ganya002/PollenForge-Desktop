import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="absolute top-2 right-2 px-2 py-0.5 text-[10px] rounded bg-surface-3/80 hover:bg-surface-3 text-text-muted hover:text-text-primary transition-smooth opacity-0 group-hover:opacity-100"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  return (
    <div className="relative group rounded-lg overflow-hidden my-3 border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-3/50 border-b border-border">
        <span className="text-[10px] text-text-muted font-mono">{language || 'code'}</span>
        <CopyButton text={children} />
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '12px',
          background: 'var(--surface-0)',
          fontSize: '13px',
          lineHeight: '1.6',
          borderRadius: 0,
        }}
        wrapLongLines
      >
        {children.replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  )
}

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const lang = match?.[1] || ''
          if (lang === 'tool') return null
          const isInline = !match && !String(children).includes('\n')
          if (isInline) {
            return (
              <code className="px-1.5 py-0.5 bg-surface-3 rounded text-accent text-[0.9em] font-mono" {...props}>
                {children}
              </code>
            )
          }
          return (
            <CodeBlock language={lang}>
              {String(children).replace(/\n$/, '')}
            </CodeBlock>
          )
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3 rounded-lg border border-border">
              <table className="w-full text-sm">{children}</table>
            </div>
          )
        },
        th({ children }) {
          return <th className="px-3 py-2 bg-surface-2 text-left text-xs font-medium text-text-secondary border-b border-border">{children}</th>
        },
        td({ children }) {
          return <td className="px-3 py-2 text-text-primary border-b border-border/50">{children}</td>
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{children}</a>
        },
        blockquote({ children }) {
          return <blockquote className="border-l-3 border-accent pl-3 text-text-secondary italic my-2">{children}</blockquote>
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
        },
        li({ children }) {
          return <li className="text-text-primary">{children}</li>
        },
        h1({ children }) {
          return <h1 className="text-xl font-bold text-text-primary mt-4 mb-2">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-lg font-semibold text-text-primary mt-3 mb-2">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-base font-semibold text-text-primary mt-2 mb-1">{children}</h3>
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>
        },
        hr() {
          return <hr className="border-border my-4" />
        },
        strong({ children }) {
          return <strong className="font-semibold text-text-primary">{children}</strong>
        },
        em({ children }) {
          return <em className="italic text-text-secondary">{children}</em>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
