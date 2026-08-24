import { contextBridge, ipcRenderer } from 'electron';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface SessionInfo {
  id: string
  name?: string
  modified?: string
  message_count?: number
  updated_at?: number
  directory?: string
  preview?: string
  pinned?: boolean
  archived?: boolean
}

contextBridge.exposeInMainWorld('api', {
  chat: {
    sendMessage: (messages: ChatMessage[], model: string, provider: string): Promise<string> => {
      return ipcRenderer.invoke('chat:send', messages, model, provider);
    },
    cancel: (): Promise<boolean> => {
      return ipcRenderer.invoke('chat:cancel');
    },
    onStreamChunk: (callback: (chunk: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk);
      ipcRenderer.on('chat:stream-chunk', handler);
      return () => {
        ipcRenderer.removeListener('chat:stream-chunk', handler);
      };
    },
    onStreamCancelled: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('chat:stream-cancelled', handler);
      return () => {
        ipcRenderer.removeListener('chat:stream-cancelled', handler);
      };
    },
  },

  files: {
    read: (filePath: string): Promise<{ success: boolean; content?: string; error?: string }> => {
      return ipcRenderer.invoke('files:read', filePath);
    },
    write: (filePath: string, content: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('files:write', filePath, content);
    },
    list: (
      dirPath: string
    ): Promise<{ success: boolean; items?: FileEntry[]; error?: string }> => {
      return ipcRenderer.invoke('files:list', dirPath);
    },
    watch: (dirPath: string): Promise<{ ok: boolean; error?: string }> => {
      return ipcRenderer.invoke('files:watch', dirPath);
    },
    onChanged: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('files:changed', handler);
      return () => {
        ipcRenderer.removeListener('files:changed', handler);
      };
    },
  },

  config: {
    get: (): Promise<{ success: boolean; config?: Record<string, unknown>; error?: string }> => {
      return ipcRenderer.invoke('config:get');
    },
    set: (
      key: string,
      value: unknown
    ): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('config:set', key, value);
    },
    save: (config: unknown): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('config:save', config);
    },
  },

  sessions: {
    list: (): Promise<{ success: boolean; sessions?: SessionInfo[]; error?: string }> => {
      return ipcRenderer.invoke('sessions:list');
    },
    load: (id: string): Promise<{ success: boolean; data?: unknown; error?: string }> => {
      return ipcRenderer.invoke('sessions:load', id);
    },
    save: (id: string, data: unknown): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('sessions:save', id, data);
    },
    saveSync: (id: string, data: unknown): { success: boolean; error?: string } => {
      return ipcRenderer.sendSync('sessions:save-sync', id, data);
    },
    delete: (id: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('sessions:delete', id);
    },
  },

  backend: {
    status: (): Promise<{ running: boolean; port?: number }> => {
      return ipcRenderer.invoke('backend:status');
    },
  },

  app: {
    quit: (): void => {
      ipcRenderer.send('app:quit');
    },
    minimize: (): void => {
      ipcRenderer.send('app:minimize');
    },
    maximize: (): void => {
      ipcRenderer.send('app:maximize');
    },
    isMaximized: (): Promise<boolean> => {
      return ipcRenderer.invoke('app:is-maximized');
    },
    onMaximized: (callback: (maximized: boolean) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) =>
        callback(maximized);
      ipcRenderer.on('window:maximized', handler);
      return () => {
        ipcRenderer.removeListener('window:maximized', handler);
      };
    },
    getVersion: (): Promise<{ version: string; packaged: boolean }> => {
      return ipcRenderer.invoke('app:get-version');
    },
    pickDirectory: (): Promise<{ ok: boolean; path?: string }> => {
      return ipcRenderer.invoke('app:pick-directory');
    },
    notifyDone: (payload?: { title?: string; body?: string }): Promise<{ ok: boolean; skipped?: boolean; error?: string }> => {
      return ipcRenderer.invoke('app:notify-done', payload);
    },
    platform: process.platform,
    nativeFrame: process.platform === 'win32',
  },

  debug: {
    log: (line: string): void => {
      ipcRenderer.send('debug:log', line);
    },
  },

  updates: {
    check: (): Promise<{ ok: boolean; packaged?: boolean; error?: string; updateInfo?: unknown }> => {
      return ipcRenderer.invoke('updates:check');
    },
    download: (): Promise<{ ok: boolean; error?: string }> => {
      return ipcRenderer.invoke('updates:download');
    },
    install: (): Promise<{ ok: boolean; error?: string }> => {
      return ipcRenderer.invoke('updates:install');
    },
    list: (): Promise<{ ok: boolean; releases?: unknown[]; error?: string }> => {
      return ipcRenderer.invoke('updates:list');
    },
    installVersion: (tag: string): Promise<{ ok: boolean; error?: string; path?: string }> => {
      return ipcRenderer.invoke('updates:install-version', tag);
    },
    onStatus: (callback: (payload: Record<string, unknown>) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: Record<string, unknown>) =>
        callback(payload);
      ipcRenderer.on('updates:status', handler);
      return () => {
        ipcRenderer.removeListener('updates:status', handler);
      };
    },
    onProgress: (
      callback: (payload: { percent: number; transferred: number; total: number }) => void,
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { percent: number; transferred: number; total: number },
      ) => callback(payload);
      ipcRenderer.on('updates:progress', handler);
      return () => {
        ipcRenderer.removeListener('updates:progress', handler);
      };
    },
  },
});
