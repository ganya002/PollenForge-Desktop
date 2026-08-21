import { useEffect, useState } from 'react'
import MarkdownRenderer from '../Chat/MarkdownRenderer'
import { useUpdates } from '../../hooks/useUpdates'
import { notesForDisplay } from '../../lib/releaseNotes'
import type { AppRelease } from '../../types/electron'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function UpdatesPanel() {
  const {
    version,
    packaged,
    status,
    progress,
    releases,
    listError,
    busy,
    check,
    download,
    install,
    installVersion,
    refreshReleases,
  } = useUpdates()
  const [confirmTag, setConfirmTag] = useState<string | null>(null)

  useEffect(() => {
    refreshReleases()
  }, [refreshReleases])

  const availableVersion = status.status === 'available' ? status.version : undefined
  const percent = Math.max(0, Math.min(100, Math.round(progress?.percent || 0)))

  const handleInstallVersion = async (release: AppRelease) => {
    if (confirmTag !== release.tag) {
      setConfirmTag(release.tag)
      return
    }
    setConfirmTag(null)
    await installVersion(release.tag)
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3 space-y-3">
        <div className="bg-surface-2 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-text-primary">Current version</div>
              <div className="text-sm font-mono text-text-secondary mt-0.5">{version}</div>
              {availableVersion && (
                <div className="text-[11px] text-emerald-400 mt-1">
                  {availableVersion} is available
                </div>
              )}
              {status.status === 'not-available' && (
                <div className="text-[11px] text-text-muted mt-1">You are up to date</div>
              )}
              {status.status === 'downloaded' && (
                <div className="text-[11px] text-emerald-400 mt-1">
                  Update downloaded. Restart to install {status.version}.
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {status.status === 'downloaded' ? (
                <button
                  onClick={install}
                  disabled={!packaged}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-accent hover:bg-accent-hover text-black disabled:opacity-40"
                >
                  Restart to update
                </button>
              ) : availableVersion ? (
                <button
                  onClick={download}
                  disabled={!packaged || busy}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-accent hover:bg-accent-hover text-black disabled:opacity-40"
                >
                  {busy ? 'Downloading…' : `Download ${availableVersion}`}
                </button>
              ) : (
                <button
                  onClick={check}
                  disabled={!packaged || busy}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-surface-3 hover:bg-surface-1 text-text-primary border border-border disabled:opacity-40"
                >
                  {busy && status.status === 'checking' ? 'Checking…' : 'Check for updates'}
                </button>
              )}
            </div>
          </div>

          {!packaged && (
            <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
              Updates work in packaged builds. Install a GitHub Release, then check from here.
            </p>
          )}

          {window.api?.app?.platform === 'darwin' && (
            <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
              On Mac, use <span className="text-text-secondary">Install this version</span> to
              download the .dmg. Zip auto-update needs Apple signing and will show a signature error.
            </p>
          )}

          {status.status === 'error' && status.message && (
            <p className="text-[11px] text-red-400 mt-3">{status.message}</p>
          )}

          {busy && progress && (
            <div className="mt-3">
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
              </div>
              <div className="text-[10px] text-text-muted mt-1 tabular-nums">{percent}%</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-text-primary">All versions</div>
          <button
            onClick={refreshReleases}
            className="text-[10px] text-text-muted hover:text-text-primary"
          >
            Refresh
          </button>
        </div>
        {listError && <p className="text-[11px] text-red-400">{listError}</p>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2">
        {releases.length === 0 && !listError && (
          <p className="text-[11px] text-text-muted">No GitHub releases yet.</p>
        )}
        {releases.map((release) => {
          const isCurrent = release.version === version
          const confirming = confirmTag === release.tag
          return (
            <div key={release.tag} className="bg-surface-2 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-primary font-mono">
                      {release.tag}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-text-secondary">
                        current
                      </span>
                    )}
                    {release.prerelease && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                        pre
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {formatDate(release.publishedAt)}
                    {release.name && release.name !== release.tag ? ` · ${release.name}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleInstallVersion(release)}
                  disabled={!packaged || busy || isCurrent || !release.asset}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-smooth disabled:opacity-40 ${
                    confirming
                      ? 'bg-red-500/15 border-red-500/40 text-red-300'
                      : 'bg-surface-1 border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {confirming ? 'Confirm install' : isCurrent ? 'Installed' : 'Install this version'}
                </button>
              </div>
              {confirming && (
                <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
                  This replaces the current app with {release.tag}. Chats and settings in this
                  computer stay. Click again to download the installer and quit Nexum.
                </p>
              )}
              <div className="release-notes markdown-body mt-2 rounded-md border border-border bg-surface-1 px-2.5 py-2 max-h-24 overflow-y-auto">
                <MarkdownRenderer content={notesForDisplay(release.body || '')} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
