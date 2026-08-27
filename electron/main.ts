import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  Notification,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import WebSocket from 'ws';
import { BackendManager } from './backend';
import { checkForUpdatesOnStartup, setupUpdater } from './updater';
import { browserWindowOptions, windowsChromiumSwitches, clampWindowBounds, resolveRenderer } from './windowOptions';
import {
  deleteSessionFile,
  importLegacySessions,
  listSessionSummaries,
  loadSessionFile,
  saveSessionFile,
} from './sessionFiles';

if (process.platform === 'win32') {
  app.disableHardwareAcceleration();
  app.setAppUserModelId('com.nexum.desktop');
  for (const [flag, value] of windowsChromiumSwitches()) {
    if (value === undefined) app.commandLine.appendSwitch(flag);
    else app.commandLine.appendSwitch(flag, value);
  }
}

// Brand as Nexum (dev mode otherwise shows "Electron" in the menu bar)
app.setName('Nexum');

// --- Crash proofing ------------------------------------------------------------
// A single instance owns port 8765; a second launch just focuses the window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function crashLog(line: string): void {
  try {
    fs.appendFileSync(
      path.join(app.getPath('userData'), 'startup.log'),
      `${new Date().toISOString()} ${line}\n`
    );
  } catch {
    console.error(line);
  }
}

// Never let a main-process JS error kill the app silently — log and continue.
process.on('uncaughtException', (err) => {
  crashLog(`uncaughtException ${err?.stack || err}`);
});
process.on('unhandledRejection', (reason) => {
  crashLog(`unhandledRejection ${String(reason)}`);
});

let rendererCrashReloads = 0;
let gpuCrashCount = 0;

function recreateMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    mainWindow = null;
  }
  createWindow();
}

// Warn when the Intel build runs under Rosetta on Apple Silicon — that combo
// is slower and crash-prone (EXC_BREAKPOINT under translation on new macOS).
function warnIfRosetta(): void {
  try {
    const under = (app as unknown as { runningUnderARM64Translation?: boolean | (() => boolean | undefined) }).runningUnderARM64Translation;
    const translated = typeof under === 'function' ? under.call(app) : under;
    if (!translated) return;
    setTimeout(() => {
      dialog.showMessageBox({
        type: 'warning',
        title: 'Wrong build for this Mac',
        message: 'Nexum is running the Intel build under Rosetta',
        detail: 'This build is slower and can crash on Apple Silicon. Download the "Mac-arm64" DMG from Releases and install it over this one. Your chats and settings are kept.',
        buttons: ['OK'],
      }).catch(() => {});
    }, 2500);
  } catch {
    /* older Electron or non-mac — ignore */
  }
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendManager: BackendManager | null = null;
let projectWatcher: fs.FSWatcher | null = null;
let projectWatchTimer: ReturnType<typeof setTimeout> | null = null;
const allowedProjectDirs = new Set<string>();

function isPathAllowed(targetPath: string, configDir: string): boolean {
  try {
    // Use realpath where possible to block symlink escape (e.g. /proj/link -> /etc)
    const tryReal = (p: string): string => {
      try {
        return fs.realpathSync(p);
      } catch {
        // File doesn't exist yet (write) — resolve its parent
        try {
          const parent = path.dirname(p);
          const realParent = fs.realpathSync(parent);
          return path.join(realParent, path.basename(p));
        } catch {
          return path.resolve(p);
        }
      }
    };
    const resolved = tryReal(targetPath);
    const configResolved = tryReal(configDir);
    if (resolved === configResolved || resolved.startsWith(configResolved + path.sep)) return true;
    for (const dir of allowedProjectDirs) {
      const allowedResolved = tryReal(dir);
      if (resolved === allowedResolved || resolved.startsWith(allowedResolved + path.sep)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const WATCH_SKIP = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist-electron', '.next', 'dist']);

function ignoreWatchPath(relative?: string | null): boolean {
  if (!relative) return false;
  return relative.split(/[\\/]/).some((part) => WATCH_SKIP.has(part));
}

function closeProjectWatcher(): void {
  if (projectWatchTimer) {
    clearTimeout(projectWatchTimer);
    projectWatchTimer = null;
  }
  if (projectWatcher) {
    projectWatcher.close();
    projectWatcher = null;
  }
}

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
  const displays = screen.getAllDisplays();
  const clamped = clampWindowBounds(
    {
      x: savedState.x,
      y: savedState.y,
      width: savedState.width || 1200,
      height: savedState.height || 800,
    },
    displays
  );

  const opts = browserWindowOptions(process.platform, clamped);
  opts.webPreferences = {
    ...opts.webPreferences,
    preload: path.join(__dirname, 'preload.js'),
  };

  mainWindow = new BrowserWindow(opts);

  const renderer = resolveRenderer(app.isPackaged, app.getAppPath(), process.resourcesPath);
  const debugLog = path.join(app.getPath('userData'), 'startup.log');
  const log = (line: string) => {
    try {
      fs.appendFileSync(debugLog, `${new Date().toISOString()} ${line}\n`);
    } catch {
      console.error(line);
    }
  };
  log(`packaged=${app.isPackaged} renderer=${JSON.stringify(renderer)} appPath=${app.getAppPath()}`);

  if (renderer.kind === 'url') {
    mainWindow.loadURL(renderer.url);
  } else {
    if (!fs.existsSync(renderer.file)) {
      log(`missing UI file: ${renderer.file}`);
    }
    mainWindow.loadFile(renderer.file);
  }

  let showedLoadError = false;
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    log(`did-fail-load ${code} ${desc} ${url}`);
    if (showedLoadError || url.startsWith('data:')) return;
    showedLoadError = true;
    const html = `<!doctype html><html><body style="margin:0;background:#141414;color:#f0f0f0;font-family:Segoe UI,sans-serif;padding:40px">
      <h1 style="font-size:20px">Nexum could not open the UI</h1>
      <p style="color:#a8a8a8;line-height:1.5">${code}: ${desc}</p>
      <p style="color:#6e6e6e;word-break:break-all">${url}</p>
    </body></html>`;
    mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log('did-finish-load');
    rendererCrashReloads = 0;
  });

  mainWindow.once('ready-to-show', () => {
    if (savedState.isMaximized) {
      mainWindow?.maximize();
    }
    mainWindow?.show();
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`render-process-gone ${JSON.stringify(details)}`);
    // Auto-recover instead of leaving a white/frozen window.
    if (details.reason === 'clean-exit') return;
    if (rendererCrashReloads < 2) {
      rendererCrashReloads += 1;
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          log(`auto-reload after renderer crash (#${rendererCrashReloads})`);
          mainWindow.webContents.reload();
        }
      }, 800);
    } else {
      recreateMainWindow();
      rendererCrashReloads = 0;
    }
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

  // No icon asset → skip the tray entirely (an empty menu-bar item is worse)
  if (!fs.existsSync(iconPath)) {
    return;
  }
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('Nexum');

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
  try {
    importLegacySessions(configDir);
  } catch (err) {
    console.error('session import failed', err);
  }

  // Window controls
  ipcMain.on('debug:log', (_event, line: string) => {
    try {
      fs.appendFileSync(
        path.join(app.getPath('userData'), 'startup.log'),
        `${new Date().toISOString()} renderer ${String(line)}\n`
      );
    } catch {
      console.error('renderer', line);
    }
  });

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

  ipcMain.handle('app:set-vibrancy', async (_event, mode: string | null) => {
    if (process.platform !== 'darwin' || !mainWindow) return { ok: false };
    try {
      const vibrancy = mode === 'sidebar' ? 'sidebar' : null;
      // @ts-ignore — vibrancy is macOS-only and not in the generic type
      mainWindow.setVibrancy(vibrancy as any);
      // Keep transparent background for glass, opaque for others
      try {
        mainWindow.setBackgroundColor(vibrancy ? '#00000000' : '#111111');
      } catch {}
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('app:pick-directory', async () => {
    const win = mainWindow;
    if (!win) return { ok: false };
    const result = await dialog.showOpenDialog(win, {
      title: 'Select project folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false };
    const picked = result.filePaths[0];
    try {
      allowedProjectDirs.add(path.resolve(picked));
    } catch {}
    return { ok: true, path: picked };
  });

  ipcMain.handle('app:notify-done', async (_event, payload?: { title?: string; body?: string }) => {
    if (mainWindow?.isFocused() && mainWindow.isVisible()) {
      return { ok: true, skipped: true };
    }
    const title = String(payload?.title || 'Nexum');
    const body = String(payload?.body || 'Agent finished').slice(0, 180);
    try {
      if (process.platform === 'darwin') {
        app.dock?.bounce('informational');
      }
    } catch {
      /* ignore */
    }
    try {
      if (Notification.isSupported()) {
        const notice = new Notification({ title, body });
        notice.on('click', () => {
          if (!mainWindow) return;
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        });
        notice.show();
      }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'notify failed' };
    }
    return { ok: true };
  });

  // Chat - streaming via WebSocket
  ipcMain.handle('chat:send', async (_event, messages: unknown[], model: string, provider: string) => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `ws://localhost:${backendManager?.port || 8765}/ws?token=${encodeURIComponent(backendManager?.authToken || '')}`,
      );

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

  // Files — scoped to userData + allowed project dirs (T7)
  ipcMain.handle('files:read', async (_event, filePath: string) => {
    try {
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(configDir, filePath);
      if (!isPathAllowed(resolvedPath, configDir)) {
        return { success: false, error: 'Path not allowed' };
      }
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
      if (!isPathAllowed(resolvedPath, configDir)) {
        return { success: false, error: 'Path not allowed' };
      }
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
      if (!isPathAllowed(resolvedPath, configDir)) {
        return { success: false, error: 'Path not allowed' };
      }
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

  ipcMain.handle('files:watch', async (_event, dirPath: string) => {
    closeProjectWatcher();
    const dir = typeof dirPath === 'string' ? dirPath.trim() : '';
    if (!dir) return { ok: true };
    try {
      allowedProjectDirs.add(path.resolve(dir));
    } catch {}
    try {
      projectWatcher = fs.watch(dir, { persistent: true, recursive: true }, (_evt, filename) => {
        if (ignoreWatchPath(filename ? String(filename) : '')) return;
        if (projectWatchTimer) clearTimeout(projectWatchTimer);
        projectWatchTimer = setTimeout(() => {
          projectWatchTimer = null;
          mainWindow?.webContents.send('files:changed');
        }, 200);
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
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

  ipcMain.handle('config:save', async (_event, body: unknown) => {
    try {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(configFilePath, JSON.stringify(body, null, 2), { encoding: 'utf-8', mode: 0o600 });
      try { fs.chmodSync(configFilePath, 0o600); } catch {}
      return { success: true };
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
      fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
      try { fs.chmodSync(configFilePath, 0o600); } catch {}
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Sessions — same JSON files the Python backend uses under userData/sessions
  ipcMain.handle('sessions:list', async () => {
    try {
      return { success: true, sessions: listSessionSummaries(configDir) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sessions:load', async (_event, id: string) => {
    try {
      return { success: true, data: loadSessionFile(configDir, id) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sessions:save', async (_event, id: string, data: unknown) => {
    try {
      saveSessionFile(configDir, id, data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.on('sessions:save-sync', (event, id: string, data: unknown) => {
    try {
      saveSessionFile(configDir, String(id || ''), data);
      event.returnValue = { success: true };
    } catch (err: any) {
      event.returnValue = { success: false, error: err.message };
    }
  });

  ipcMain.handle('sessions:delete', async (_event, id: string) => {
    try {
      deleteSessionFile(configDir, id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Backend status + per-launch auth token for renderer fetch/WS
  ipcMain.handle('backend:status', async () => {
    if (!backendManager) {
      return { running: false };
    }
    const isHealthy = await backendManager.checkHealth();
    return { running: isHealthy, port: backendManager.port };
  });

  ipcMain.handle('backend:token', () => {
    return { token: backendManager?.authToken || '' };
  });
}

async function startBackend(): Promise<void> {
  backendManager = new BackendManager(8765);
  try {
    await backendManager.start();
    console.log('Backend started successfully');
  } catch (err) {
    console.error('Failed to start backend:', err);
    try {
      fs.appendFileSync(
        path.join(app.getPath('userData'), 'startup.log'),
        `${new Date().toISOString()} backend-start-failed ${String(err)}\n`
      );
    } catch {
      /* ignore */
    }
  }
}

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0] || mainWindow;
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } else {
    createWindow();
  }
});

app.whenReady().then(async () => {
  setupIpcHandlers();
  setupUpdater(() => mainWindow);
  await startBackend();
  createWindow();
  createTray();

  app.on('child-process-gone', (_event, details) => {
    try {
      fs.appendFileSync(
        path.join(app.getPath('userData'), 'startup.log'),
        `${new Date().toISOString()} child-process-gone ${JSON.stringify(details)}\n`
      );
    } catch {
      console.error('child-process-gone', details);
    }
    if (details.type === 'GPU' || details.name === 'GPU') {
      gpuCrashCount += 1;
      if (gpuCrashCount >= 2 && process.platform !== 'win32') {
        crashLog('GPU process crashed twice — disabling hardware acceleration and recreating window');
        app.disableHardwareAcceleration();
      }
      if (gpuCrashCount <= 3) {
        setTimeout(() => recreateMainWindow(), 700);
      }
    }
  });

  warnIfRosetta();
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
  closeProjectWatcher();
  if (backendManager) {
    backendManager.stop();
    backendManager = null;
  }
});
