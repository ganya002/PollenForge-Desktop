import { useState, useEffect } from 'react'
import { useStore, FileEntry } from '../../store/store'
import { FileTypeIcon } from './fileIcons'
import { addFileToChat, openWorkspaceFile } from '../../lib/workspaceFiles'

function GitBadge({ status }: { status?: string }) {
  if (!status) return null
  const colors: Record<string, string> = {
    modified: 'bg-warning',
    new: 'bg-success',
    deleted: 'bg-danger',
    untracked: 'bg-text-muted',
  }
  const labels: Record<string, string> = {
    modified: 'M',
    new: 'A',
    deleted: 'D',
    untracked: '?',
  }
  return (
    <span
      className={`w-3.5 h-3.5 rounded text-[8px] font-bold flex items-center justify-center ${colors[status] || 'bg-text-muted'} text-white`}
      title={status}
    >
      {labels[status] || '?'}
    </span>
  )
}

function TreeNode({ entry, depth = 0 }: { entry: FileEntry; depth?: number }) {
  const [expanded, setExpanded] = useState(!!entry.expanded)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const isExpanded = expanded && entry.isDirectory
  const active = useStore((s) => s.activeFilePath === entry.path)

  const handleClick = async () => {
    if (entry.isDirectory) {
      const next = !expanded
      setExpanded(next)
      if (next && !entry.children) {
        try {
          const res = await fetch(`http://127.0.0.1:8765/files/list?path=${encodeURIComponent(entry.path)}`)
          const data = await res.json()
          if (data.entries) {
            const children: FileEntry[] = data.entries.map((item: Record<string, unknown>) => ({
              name: item.name as string,
              path: (item.path as string) || entry.path + '/' + (item.name as string),
              isDirectory: (item.is_dir as boolean) ?? (item.isDirectory as boolean) ?? false,
              size: (item.size as number | null) ?? null,
              modified: (item.modified as number) ?? 0,
              git_status: item.git_status as string | undefined,
            }))
            useStore.getState().setFileTree(
              updateTree(useStore.getState().fileTree, entry.path, children)
            )
          }
        } catch (e) {
          console.error('Failed to list directory:', e)
        }
      }
    } else {
      void openWorkspaceFile(entry.path)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`w-full flex items-center gap-1.5 px-2 h-7 text-[13px] hover:bg-surface-2 hover:text-text-primary transition-smooth rounded group ${
          active ? 'bg-surface-2 text-text-primary' : 'text-text-secondary'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        title={entry.path}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          className={`shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''} ${entry.isDirectory ? 'opacity-60' : 'opacity-0'}`}
        >
          <path d="M3 2l4 3-4 3z" />
        </svg>
        <FileTypeIcon name={entry.name} isDirectory={entry.isDirectory} isExpanded={isExpanded} />
        <span className="truncate flex-1 text-left">{entry.name}</span>
        <GitBadge status={entry.git_status} />
      </button>
      {menu && !entry.isDirectory && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 bg-surface-3 border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              onClick={() => {
                void openWorkspaceFile(entry.path)
                setMenu(null)
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              Open
            </button>
            <button
              onClick={() => {
                addFileToChat(entry.path)
                setMenu(null)
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              Add to chat
            </button>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(entry.path)
                setMenu(null)
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              Copy path
            </button>
          </div>
        </>
      )}
      {isExpanded && entry.children?.map((child) => (
        <TreeNode key={child.path} entry={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function updateTree(entries: FileEntry[], targetPath: string, children: FileEntry[]): FileEntry[] {
  return entries.map((e) => {
    if (e.path === targetPath) return { ...e, children, expanded: true }
    if (e.children) return { ...e, children: updateTree(e.children, targetPath, children) }
    return e
  })
}

export default function FileTree() {
  const fileTree = useStore((s) => s.fileTree)
  const setFileTree = useStore((s) => s.setFileTree)

  const refreshTree = () => {
    fetch('http://127.0.0.1:8765/files/list?path=.')
      .then((r) => r.json())
      .then((data) => {
        if (data.entries) {
          setFileTree(
            data.entries.map((item: Record<string, unknown>) => ({
              name: item.name as string,
              path: (item.path as string) || (item.name as string),
              isDirectory: (item.is_dir as boolean) ?? (item.isDirectory as boolean) ?? false,
              size: (item.size as number | null) ?? null,
              modified: (item.modified as number) ?? 0,
              git_status: item.git_status as string | undefined,
            }))
          )
        }
      })
      .catch(console.error)
  }

  useEffect(() => {
    if (fileTree.length === 0) {
      refreshTree()
    }
  }, [])

  return (
    <div className="px-2 py-1">
      <div className="flex items-center justify-between px-2 h-8">
        <span className="sidebar-label">Files</span>
        <button
          onClick={refreshTree}
          className="p-0.5 rounded hover:bg-surface-2 text-text-muted hover:text-text-secondary transition-smooth"
          title="Refresh file tree"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M8.5 5a3.5 3.5 0 1 1-1-2.5" />
            <path d="M8.5 1.5v1h-1" />
          </svg>
        </button>
      </div>
      {fileTree.map((entry) => (
        <TreeNode key={entry.path} entry={entry} />
      ))}
    </div>
  )
}
