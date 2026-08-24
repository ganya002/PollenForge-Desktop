import { apiFetch } from '../../lib/api'
import { useState, useEffect } from 'react'
import { useStore, FileEntry } from '../../store/store'
import { FileTypeIcon } from './fileIcons'
import { addFileToChat, openWorkspaceFile } from '../../lib/workspaceFiles'
import { projectPathFromDrop } from '../../lib/chatActions'
import {
  clearDefaultDirectory,
  currentWorkspace,
  deleteWorkspaceFile,
  folderName,
  persistDefaultFromCurrent,
  pickAndSetProjectFolder,
  refreshFileTree,
  renameWorkspaceFile,
  scheduleFileTreeRefresh,
  setChatDirectory,
  writeWorkspaceFile,
} from '../../lib/workspace'

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

function TreeNode({ entry, depth = 0, root }: { entry: FileEntry; depth?: number; root: string }) {
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
          const res = await apiFetch(
            `http://127.0.0.1:8765/files/list?path=${encodeURIComponent(entry.path)}&root=${encodeURIComponent(root)}`
          )
          const data = await res.json()
          if (data.entries) {
            const children: FileEntry[] = data.entries.map((item: Record<string, unknown>) => ({
              name: item.name as string,
              path: (item.path as string) || entry.path + '/' + (item.name as string),
              isDirectory: (item.is_dir as boolean) ?? (item.isDirectory as boolean) ?? false,
              size: (item.size as number | null) ?? null,
              modified: (item.modified as number) ?? 0,
              git_status: item.git_status as FileEntry['git_status'],
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
      void openWorkspaceFile(entry.path, { root })
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const parentDir = entry.path.replace(/\\/g, '/').replace(/\/?[^/]+$/, '') || '.'

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-nexum-path', entry.path)
          e.dataTransfer.setData('text/plain', entry.path)
          e.dataTransfer.effectAllowed = 'copy'
        }}
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
      {menu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 bg-surface-3 border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
            style={{ left: menu.x, top: menu.y }}
          >
            {!entry.isDirectory && (
              <>
                <button
                  onClick={() => {
                    void openWorkspaceFile(entry.path, { root })
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
              </>
            )}
            <button
              onClick={async () => {
                const name = window.prompt('New file name', entry.isDirectory ? `${entry.path}/untitled.txt` : `${parentDir}/untitled.txt`)
                setMenu(null)
                if (!name?.trim()) return
                try {
                  await writeWorkspaceFile(name.trim(), '', root)
                  await refreshFileTree()
                } catch (err) {
                  useStore.getState().pushToast({ kind: 'error', text: err instanceof Error ? err.message : 'Could not create file' })
                }
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              New file
            </button>
            {!entry.isDirectory && (
              <button
                onClick={async () => {
                  const name = window.prompt('Rename', entry.name)
                  setMenu(null)
                  if (!name?.trim() || name.trim() === entry.name) return
                  const dest = `${parentDir === '.' ? '' : `${parentDir}/`}${name.trim()}`
                  try {
                    await renameWorkspaceFile(entry.path, dest, root)
                    await refreshFileTree()
                  } catch (err) {
                    useStore.getState().pushToast({ kind: 'error', text: err instanceof Error ? err.message : 'Could not rename' })
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
              >
                Rename
              </button>
            )}
            <button
              onClick={() => {
                void navigator.clipboard.writeText(entry.path)
                setMenu(null)
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              Copy path
            </button>
            {!entry.isDirectory && (
              <button
                onClick={async () => {
                  setMenu(null)
                  if (!window.confirm(`Delete ${entry.name}?`)) return
                  try {
                    await deleteWorkspaceFile(entry.path, root)
                    await refreshFileTree()
                  } catch (err) {
                    useStore.getState().pushToast({ kind: 'error', text: err instanceof Error ? err.message : 'Could not delete' })
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}
      {isExpanded && entry.children?.map((child) => (
        <TreeNode key={child.path} entry={child} depth={depth + 1} root={root} />
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
  const currentSessionId = useStore((s) => s.currentSessionId)
  const pendingWorkspace = useStore((s) => s.pendingWorkspace)
  const defaultDirectory = useStore((s) => s.config.default_directory)
  const sessionDir = useStore((s) => s.sessions.find((x) => x.id === s.currentSessionId)?.directory)
  const dir = currentWorkspace()
  const isDefault = !!dir && dir === defaultDirectory

  useEffect(() => {
    void refreshFileTree()
  }, [currentSessionId, pendingWorkspace, defaultDirectory, sessionDir])

  useEffect(() => {
    const api = window.api?.files
    if (!dir || !api?.watch) return
    void api.watch(dir)
    const off = api.onChanged?.(() => scheduleFileTreeRefresh(dir))
    return () => {
      void api.watch('')
      off?.()
    }
  }, [dir])

  const acceptFolderDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const folder = projectPathFromDrop(Array.from(e.dataTransfer.files).map((file) => ({
      path: (file as File & { path?: string }).path,
      name: file.name,
    })))
    if (folder) void setChatDirectory(folder)
  }

  return (
    <div
      className="px-2 py-1"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={acceptFolderDrop}
    >
      <div className="flex items-center justify-between px-2 h-8">
        <span className="sidebar-label">Files</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={async () => {
              const name = window.prompt('New file (relative path)')
              if (!name?.trim()) return
              try {
                await writeWorkspaceFile(name.trim(), '')
                await refreshFileTree()
              } catch (err) {
                useStore.getState().pushToast({ kind: 'error', text: err instanceof Error ? err.message : 'Could not create file' })
              }
            }}
            className="p-0.5 rounded hover:bg-surface-2 text-text-muted hover:text-text-secondary transition-smooth"
            title="New file"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M5 1.5v7M1.5 5h7" />
            </svg>
          </button>
          <button
            onClick={() => void pickAndSetProjectFolder()}
            className="p-0.5 rounded hover:bg-surface-2 text-text-muted hover:text-text-secondary transition-smooth"
            title="Select project folder"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M1.5 3.5A1.5 1.5 0 013 2h4l2 2h5a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0114 14H3a1.5 1.5 0 01-1.5-1.5v-9z" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() => void refreshFileTree()}
            className="p-0.5 rounded hover:bg-surface-2 text-text-muted hover:text-text-secondary transition-smooth"
            title="Refresh file tree"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <path d="M8.5 5a3.5 3.5 0 1 1-1-2.5" />
              <path d="M8.5 1.5v1h-1" />
            </svg>
          </button>
        </div>
      </div>
      {dir ? (
        <>
          <button
            onClick={() => void pickAndSetProjectFolder()}
            className="w-full text-left px-2 py-1 mb-1 rounded hover:bg-surface-2 text-[12px] text-text-secondary truncate"
            title={dir}
          >
            {folderName(dir)}
          </button>
          <label className="flex items-center gap-1.5 px-2 mb-1 text-[11px] text-text-muted">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => {
                if (e.target.checked) persistDefaultFromCurrent()
                else clearDefaultDirectory()
              }}
            />
            Default for new chats
          </label>
          {fileTree.map((entry) => (
            <TreeNode key={entry.path} entry={entry} root={dir} />
          ))}
        </>
      ) : (
        <div className="px-2 py-3 text-[12px] text-text-muted">
          <p className="mb-2 leading-5">Select a project folder for this chat, or drop a folder here. Other chats can share it or pick their own.</p>
          <button
            onClick={() => void pickAndSetProjectFolder()}
            className="h-7 px-2.5 rounded-md bg-surface-2 border border-border text-text-secondary hover:text-text-primary text-[12px]"
          >
            Select folder
          </button>
        </div>
      )}
    </div>
  )
}
