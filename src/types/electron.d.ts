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
      backend?: {
        /** Per-launch auth token for the local Nexum backend (T1). */
        token: () => string
      }
      app: {
        quit: () => void
        minimize: () => void
        maximize: () => void
        isMaximized: () => Promise<boolean>
        onMaximized: (cb: (maximized: boolean) => void) => () => void
        getVersion: () => Promise<{ version: string; packaged: boolean }>
        pickDirectory: () => Promise<{ ok: boolean; path?: string }>
        platform: string
        nativeFrame: boolean
      }
      files?: {
        read: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
        write: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
        list: (dirPath: string) => Promise<{ success: boolean; items?: unknown[]; error?: string }>
        watch: (dirPath: string) => Promise<{ ok: boolean; error?: string }>
        onChanged: (cb: () => void) => () => void
      }
      config?: {
        get: () => Promise<{ success: boolean; config?: Record<string, unknown>; error?: string }>
        set: (key: string, value: unknown) => Promise<{ success: boolean; error?: string }>
        save: (config: unknown) => Promise<{ success: boolean; error?: string }>
      }
      sessions?: {
        list: () => Promise<{ success: boolean; sessions?: Record<string, unknown>[]; error?: string }>
        load: (id: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
        save: (id: string, data: unknown) => Promise<{ success: boolean; error?: string }>
        saveSync: (id: string, data: unknown) => { success: boolean; error?: string }
        delete: (id: string) => Promise<{ success: boolean; error?: string }>
      }
      debug?: {
        log: (line: string) => void
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
