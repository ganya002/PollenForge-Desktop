import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { GITHUB_OWNER, GITHUB_REPO, installReleaseVersion, listReleases } from './releases';

const PACKAGED_ONLY = 'Updates are available in packaged builds. Install a GitHub Release to enable them.';

function send(window: BrowserWindow | null, channel: string, payload: unknown): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, payload);
  }
}

export function setupUpdater(getWindow: () => BrowserWindow | null): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  });

  autoUpdater.on('checking-for-update', () => {
    send(getWindow(), 'updates:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    send(getWindow(), 'updates:status', { status: 'available', version: info.version, info });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    send(getWindow(), 'updates:status', { status: 'not-available', version: info.version, info });
  });

  autoUpdater.on('download-progress', (progress) => {
    send(getWindow(), 'updates:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    send(getWindow(), 'updates:status', { status: 'downloaded', version: info.version, info });
  });

  autoUpdater.on('error', (err) => {
    send(getWindow(), 'updates:status', {
      status: 'error',
      message: err?.message || 'Update check failed',
    });
  });

  ipcMain.handle('app:get-version', () => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
  }));

  ipcMain.handle('updates:check', async () => {
    if (!app.isPackaged) {
      return { ok: false, packaged: false, error: PACKAGED_ONLY };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, packaged: true, updateInfo: result?.updateInfo ?? null };
    } catch (err: any) {
      return { ok: false, packaged: true, error: err?.message || 'Failed to check for updates.' };
    }
  });

  ipcMain.handle('updates:download', async () => {
    if (!app.isPackaged) {
      return { ok: false, error: PACKAGED_ONLY };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to download update.' };
    }
  });

  ipcMain.handle('updates:install', () => {
    if (!app.isPackaged) {
      return { ok: false, error: PACKAGED_ONLY };
    }
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });

  ipcMain.handle('updates:list', async () => {
    try {
      const releases = await listReleases();
      return { ok: true, releases };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to load releases.', releases: [] };
    }
  });

  ipcMain.handle('updates:install-version', async (_event, tag: string) => {
    if (!app.isPackaged) {
      return { ok: false, error: PACKAGED_ONLY };
    }
    if (!tag || typeof tag !== 'string') {
      return { ok: false, error: 'Missing release tag.' };
    }

    send(getWindow(), 'updates:status', { status: 'downloading-version', tag });
    const result = await installReleaseVersion(tag, (percent, transferred, total) => {
      send(getWindow(), 'updates:progress', { percent, transferred, total });
    });

    if (result.ok === false) {
      send(getWindow(), 'updates:status', { status: 'error', message: result.error });
    }
    return result;
  });
}

export function checkForUpdatesOnStartup(): void {
  if (!app.isPackaged) return;
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Startup update check failed:', err);
    });
  }, 4000);
}
