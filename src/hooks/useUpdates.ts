import { useCallback, useEffect, useState } from 'react'
import type { AppRelease, UpdateProgress, UpdateStatus } from '../types/electron'

const ACTIVE = new Set(['checking', 'downloading-version'])

type Session = {
  version: string
  packaged: boolean
  status: UpdateStatus
  progress: UpdateProgress | null
  releases: AppRelease[]
  listError: string | null
  busy: boolean
}

const session: Session = {
  version: '…',
  packaged: false,
  status: { status: 'idle' },
  progress: null,
  releases: [],
  listError: null,
  busy: false,
}

function isActiveStatus(status: UpdateStatus['status']): boolean {
  return ACTIVE.has(status)
}

export function useUpdates() {
  const [version, setVersion] = useState(session.version)
  const [packaged, setPackaged] = useState(session.packaged)
  const [status, setStatus] = useState<UpdateStatus>(session.status)
  const [progress, setProgress] = useState<UpdateProgress | null>(session.progress)
  const [releases, setReleases] = useState<AppRelease[]>(session.releases)
  const [listError, setListError] = useState<string | null>(session.listError)
  const [busy, setBusy] = useState(session.busy)

  useEffect(() => {
    if (!window.api?.app?.getVersion) return
    window.api.app.getVersion().then((info) => {
      session.version = info.version
      session.packaged = info.packaged
      setVersion(info.version)
      setPackaged(info.packaged)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!window.api?.updates) return
    const offStatus = window.api.updates.onStatus((payload) => {
      const next: UpdateStatus = {
        status: payload.status || 'idle',
        version: payload.version,
        tag: payload.tag,
        message: payload.message,
      }
      session.status = next
      setStatus(next)
      if (isActiveStatus(next.status)) {
        session.busy = true
        setBusy(true)
      } else if (next.status === 'downloaded' || next.status === 'error' || next.status === 'not-available') {
        session.busy = false
        setBusy(false)
        if (next.status !== 'downloaded') {
          session.progress = null
          setProgress(null)
        }
      }
    })
    const offProgress = window.api.updates.onProgress((payload) => {
      session.progress = payload
      session.busy = true
      setProgress(payload)
      setBusy(true)
    })
    return () => {
      offStatus()
      offProgress()
    }
  }, [])

  const refreshReleases = useCallback(async () => {
    if (!window.api?.updates) return
    const result = await window.api.updates.list()
    if (result.ok && result.releases) {
      session.releases = result.releases
      session.listError = null
      setReleases(result.releases)
      setListError(null)
    } else {
      session.listError = result.error || 'Failed to load releases'
      setListError(session.listError)
    }
  }, [])

  const check = useCallback(async () => {
    if (!window.api?.updates || session.busy) return
    session.busy = true
    session.progress = null
    setBusy(true)
    setProgress(null)
    const result = await window.api.updates.check()
    if (!result.ok) {
      if (/already downloading/i.test(result.error || '')) return
      session.status = { status: 'error', message: result.error }
      session.busy = false
      setStatus(session.status)
      setBusy(false)
    }
  }, [])

  const download = useCallback(async () => {
    if (!window.api?.updates || session.busy) return
    session.busy = true
    session.progress = { percent: 0, transferred: 0, total: 0 }
    setBusy(true)
    setProgress(session.progress)
    const result = await window.api.updates.download()
    if (!result.ok) {
      if (/already downloading/i.test(result.error || '')) return
      session.status = { status: 'error', message: result.error }
      session.busy = false
      setStatus(session.status)
      setBusy(false)
    }
  }, [])

  const install = useCallback(async () => {
    if (!window.api?.updates) return
    await window.api.updates.install()
  }, [])

  const installVersion = useCallback(async (tag: string) => {
    if (!window.api?.updates) return { ok: false as const, error: 'Updates API unavailable' }
    if (session.busy) return { ok: false as const, error: 'An update is already downloading.' }
    session.busy = true
    session.progress = { percent: 0, transferred: 0, total: 0 }
    setBusy(true)
    setProgress(session.progress)
    const result = await window.api.updates.installVersion(tag)
    if (!result.ok) {
      if (/already downloading/i.test(result.error || '')) {
        return result
      }
      session.status = { status: 'error', message: result.error }
      session.busy = false
      setStatus(session.status)
      setBusy(false)
    }
    return result
  }, [])

  return {
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
  }
}
