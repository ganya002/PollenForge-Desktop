import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import WebSocket from 'ws';
import { BackendManager } from './backend';
import { checkForUpdatesOnStartup, setupUpdater } from './updater';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendManager: BackendManager | null = null;

const WINDOW_STATE_FILE = 'window-state.json';

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function loadWindowState(): Partial<WindowState> {
  try {
    const data = fs.readFileSync(getWindowStatePath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function saveWindowState(state: WindowState): void {
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}

function createWindow(): void {
  const savedState = loadWindowState();
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const windowWidth = savedState.width || 1200;
  const windowHeight = savedState.height || 800;
  const windowX = savedState.x !== undefined
    ? Math.min(savedState.x, screenWidth - windowWidth)
    : undefined;
  const windowY = savedState.y !== undefined
    ? Math.min(savedState.y, screenHeight - windowHeight)
    : undefined;

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: windowX,
    y: windowY,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0d1117',
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // In dev mode, load from Vite dev server; in production, load from dist
  const isDev = !fs.existsSync(path.join(__dirname, '../../dist/index.html'));
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized', false);
  });

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: mainWindow.isMaximized(),
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');

  let trayIcon: Electron.NativeImage;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('PollenForge');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function setupIpcHandlers(): void {
  const configDir = app.getPath('userData');
  const sessionsDir = path.join(configDir, 'sessions');
  const configFilePath = path.join(configDir, 'config.json');

  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  // Window controls
  ipcMain.on('app:quit', () => {
    app.quit();
  });

  ipcMain.on('app:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('app:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('app:is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // Chat - streaming via WebSocket
  ipcMain.handle('chat:send', async (_event, messages: unknown[], model: string, provider: string) => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${backendManager?.port || 8765}/ws`);

      const chunks: string[] = [];

      ws.on('open', () => {
        ws.send(JSON.stringify({ messages, model, provider }));
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'chunk' && parsed.content) {
            chunks.push(parsed.content);
            mainWindow?.webContents.send('chat:stream-chunk', parsed.content);
          } else if (parsed.type === 'done') {
            ws.close();
            resolve(chunks.join(''));
          } else if (parsed.type === 'error') {
            ws.close();
            reject(new Error(parsed.message || 'Chat request failed'));
          }
        } catch (err) {
          ws.close();
          reject(err);
        }
      });

      ws.on('error', (err) => {
        reject(new Error(`WebSocket error: ${err.message}`));
      });

      ws.on('close', () => {
        if (chunks.length > 0 && !ws.CLOSED) {
          resolve(chunks.join(''));
        }
      });

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
          reject(new Error('Chat request timed out'));
        }
      }, 120_000);
    });
  });

  ipcMain.handle('chat:cancel', async () => {
    mainWindow?.webContents.send('chat:stream-cancelled');
    return true;
  });

  // Files
  ipcMain.handle('files:read', async (_event, filePath: string) => {
    try {
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(configDir, filePath);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      return { success: true, content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('files:write', async (_event, filePath: string, content: string) => {
    try {
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(configDir, filePath);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(resolvedPath, content, 'utf-8');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('files:list', async (_event, dirPath: string) => {
    try {
      const resolvedPath = path.isAbsolute(dirPath)
        ? dirPath
        : path.join(configDir, dirPath);
      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      const items = entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(resolvedPath, entry.name),
      }));
      return { success: true, items };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Config
  ipcMain.handle('config:get', async () => {
    try {
      if (fs.existsSync(configFilePath)) {
        const data = fs.readFileSync(configFilePath, 'utf-8');
        return { success: true, config: JSON.parse(data) };
      }
      return { success: true, config: {} };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('config:set', async (_event, key: string, value: unknown) => {
    try {
      let config: Record<string, unknown> = {};
      if (fs.existsSync(configFilePath)) {
        const data = fs.readFileSync(configFilePath, 'utf-8');
        config = JSON.parse(data);
      }
      config[key] = value;
      fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Sessions
  ipcMain.handle('sessions:list', async () => {
    try {
      const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
      const sessions = files.map((file) => {
        const id = path.basename(file, '.json');
        const filePath = path.join(sessionsDir, file);
        const stat = fs.statSync(filePath);
        return { id, modified: stat.mtime.toISOString() };
      });
      sessions.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      return { success: true, sessions };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sessions:load', async (_event, id: string) => {
    try {
      const filePath = path.join(sessionsDir, `${id}.json`);
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sessions:save', async (_event, id: string, data: unknown) => {
    try {
      const filePath = path.join(sessionsDir, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Backend status
  ipcMain.handle('backend:status', async () => {
    if (!backendManager) {
      return { running: false };
    }
    const isHealthy = await backendManager.checkHealth();
    return { running: isHealthy, port: backendManager.port };
  });
}

async function startBackend(): Promise<void> {
  backendManager = new BackendManager(8765);
  try {
    await backendManager.start();
    console.log('Backend started successfully');
  } catch (err) {
    console.error('Failed to start backend:', err);
  }
}

app.whenReady().then(async () => {
  setupIpcHandlers();
  setupUpdater(() => mainWindow);
  createWindow();
  createTray();
  await startBackend();
  checkForUpdatesOnStartup();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (backendManager) {
    backendManager.stop();
    backendManager = null;
  }
});
