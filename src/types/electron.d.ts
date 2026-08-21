export interface AppReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

export interface AppRelease {
  tag: string
  version: string
  name: string
  body: string
  publishedAt: string
  prerelease: boolean
  htmlUrl: string
  asset: AppReleaseAsset | null
}

export type UpdateStatusKind =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloaded'
  | 'downloading-version'
  | 'error'

export interface UpdateStatus {
  status: UpdateStatusKind
  version?: string
  tag?: string
  message?: string
}

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
}

declare global {
  interface Window {
    api: {
      app: {
        quit: () => void
        minimize: () => void
        maximize: () => void
        isMaximized: () => Promise<boolean>
        onMaximized: (cb: (maximized: boolean) => void) => () => void
        getVersion: () => Promise<{ version: string; packaged: boolean }>
        platform: string
        nativeFrame: boolean
      }
      updates: {
        check: () => Promise<{ ok: boolean; packaged?: boolean; error?: string; updateInfo?: unknown }>
        download: () => Promise<{ ok: boolean; error?: string }>
        install: () => Promise<{ ok: boolean; error?: string }>
        list: () => Promise<{ ok: boolean; releases?: AppRelease[]; error?: string }>
        installVersion: (tag: string) => Promise<{ ok: boolean; error?: string; path?: string }>
        onStatus: (cb: (payload: UpdateStatus) => void) => () => void
        onProgress: (cb: (payload: UpdateProgress) => void) => () => void
      }
    }
  }
}

export {}
