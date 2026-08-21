import { useEffect } from 'react'
import { useStore } from '../store/store'
import { compareVersions } from '../lib/version'

export function useAvailableUpdate() {
  const setAvailableUpdate = useStore((s) => s.setAvailableUpdate)

  useEffect(() => {
    let cancelled = false

    async function detect() {
      if (!window.api?.updates || !window.api?.app?.getVersion) return
      try {
        const info = await window.api.app.getVersion()
        const listed = await window.api.updates.list()
        if (cancelled) return
        const latest = listed.releases?.find((r) => !r.prerelease)
        if (latest && compareVersions(latest.version, info.version) > 0) {
          setAvailableUpdate(latest.version)
        }
      } catch {
        // GitHub may be unreachable; electron-updater events still apply when packaged.
      }
    }

    detect()

    if (!window.api?.updates) return
    const off = window.api.updates.onStatus((payload) => {
      if (payload.status === 'available' && payload.version) {
        setAvailableUpdate(payload.version)
      }
      if (payload.status === 'not-available') {
        setAvailableUpdate(null)
      }
    })
    return () => {
      cancelled = true
      off()
    }
  }, [setAvailableUpdate])
}
