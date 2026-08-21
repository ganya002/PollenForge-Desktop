import { useCallback, useEffect, useState } from 'react'
import type { AppRelease, UpdateProgress, UpdateStatus } from '../types/electron'

export function useUpdates() {
  const [version, setVersion] = useState('…')
  const [packaged, setPackaged] = useState(false)
  const [status, setStatus] = useState<UpdateStatus>({ status: 'idle' })
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [releases, setReleases] = useState<AppRelease[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!window.api?.app?.getVersion) return
    window.api.app.getVersion().then((info) => {
      setVersion(info.version)
      setPackaged(info.packaged)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!window.api?.updates) return
    const offStatus = window.api.updates.onStatus((payload) => {
      setStatus({
        status: payload.status || 'idle',
        version: payload.version,
        tag: payload.tag,
        message: payload.message,
      })
      if (payload.status !== 'checking' && payload.status !== 'downloading-version') {
        setBusy(false)
      }
    })
    const offProgress = window.api.updates.onProgress((payload) => {
      setProgress(payload)
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
      setReleases(result.releases)
      setListError(null)
    } else {
      setListError(result.error || 'Failed to load releases')
    }
  }, [])

  const check = useCallback(async () => {
    if (!window.api?.updates) return
    setBusy(true)
    setProgress(null)
    const result = await window.api.updates.check()
    if (!result.ok) {
      setStatus({ status: 'error', message: result.error })
      setBusy(false)
    }
  }, [])

  const download = useCallback(async () => {
    if (!window.api?.updates) return
    setBusy(true)
    setProgress({ percent: 0, transferred: 0, total: 0 })
    const result = await window.api.updates.download()
    if (!result.ok) {
      setStatus({ status: 'error', message: result.error })
      setBusy(false)
    }
  }, [])

  const install = useCallback(async () => {
    if (!window.api?.updates) return
    await window.api.updates.install()
  }, [])

  const installVersion = useCallback(async (tag: string) => {
    if (!window.api?.updates) return { ok: false as const, error: 'Updates API unavailable' }
    setBusy(true)
    setProgress({ percent: 0, transferred: 0, total: 0 })
    const result = await window.api.updates.installVersion(tag)
    if (!result.ok) {
      setStatus({ status: 'error', message: result.error })
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
