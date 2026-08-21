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
  id: string;
  modified: string;
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
  },
});
