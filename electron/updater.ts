import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { compareVersions, GITHUB_OWNER, GITHUB_REPO, installReleaseVersion, listReleases } from './releases';

const PACKAGED_ONLY = 'Updates are available in packaged builds. Install a GitHub Release to enable them.';
const MAC_DMG_ONLY =
  'Mac zip auto-update needs Apple signing. Use Install this version below to download the .dmg.';

function send(window: BrowserWindow | null, channel: string, payload: unknown): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, payload);
  }
}

let updateBusy = false;

async function withUpdateLock<T extends { ok: boolean }>(
  work: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  if (updateBusy) {
    return { ok: false, error: 'An update is already downloading.' };
  }
  updateBusy = true;
  try {
    return await work();
  } finally {
    updateBusy = false;
  }
}

function friendlyUpdateError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err || 'Update check failed');
  if (/signature|ShipIt|code has no resources|did not pass validation/i.test(message)) {
    return MAC_DMG_ONLY;
  }
  return message;
}

async function checkMacRelease(getWindow: () => BrowserWindow | null) {
  const releases = await listReleases();
  const latest = releases.find((r) => !r.prerelease);
  const current = app.getVersion();
  if (latest && compareVersions(latest.version, current) > 0) {
    send(getWindow(), 'updates:status', { status: 'available', version: latest.version, tag: latest.tag });
    return { ok: true as const, packaged: true, updateInfo: { version: latest.version, tag: latest.tag } };
  }
  send(getWindow(), 'updates:status', { status: 'not-available', version: current });
  return { ok: true as const, packaged: true, updateInfo: null };
}

export function setupUpdater(getWindow: () => BrowserWindow | null): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  (autoUpdater as { verifyUpdateCodeSignature?: boolean }).verifyUpdateCodeSignature = false;
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
      message: friendlyUpdateError(err),
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
    if (process.platform === 'darwin') {
      try {
        return await checkMacRelease(getWindow);
      } catch (err) {
        return { ok: false, packaged: true, error: friendlyUpdateError(err) };
      }
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, packaged: true, updateInfo: result?.updateInfo ?? null };
    } catch (err: any) {
      return { ok: false, packaged: true, error: friendlyUpdateError(err) };
    }
  });

  ipcMain.handle('updates:download', async () => {
    if (!app.isPackaged) {
      return { ok: false, error: PACKAGED_ONLY };
    }
    return withUpdateLock(async () => {
      if (process.platform === 'darwin') {
        try {
          const releases = await listReleases();
          const latest = releases.find((r) => !r.prerelease);
          if (!latest) return { ok: false, error: 'No Mac release found.' };
          send(getWindow(), 'updates:status', { status: 'downloading-version', tag: latest.tag });
          const result = await installReleaseVersion(latest.tag, (percent, transferred, total) => {
            send(getWindow(), 'updates:progress', { percent, transferred, total });
          });
          if (result.ok === false) {
            send(getWindow(), 'updates:status', { status: 'error', message: result.error });
          }
          return result;
        } catch (err) {
          return { ok: false, error: friendlyUpdateError(err) };
        }
      }
      try {
        send(getWindow(), 'updates:status', { status: 'downloading-version', version: app.getVersion() });
        await autoUpdater.downloadUpdate();
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: friendlyUpdateError(err) };
      }
    });
  });

  ipcMain.handle('updates:install', () => {
    if (!app.isPackaged) {
      return { ok: false, error: PACKAGED_ONLY };
    }
    if (process.platform === 'darwin') {
      return { ok: false, error: MAC_DMG_ONLY };
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

    return withUpdateLock(async () => {
      send(getWindow(), 'updates:status', { status: 'downloading-version', tag });
      const result = await installReleaseVersion(tag, (percent, transferred, total) => {
        send(getWindow(), 'updates:progress', { percent, transferred, total });
      });

      if (result.ok === false) {
        send(getWindow(), 'updates:status', { status: 'error', message: result.error });
      }
      return result;
    });
  });
}

export function checkForUpdatesOnStartup(): void {
  if (!app.isPackaged) return;
  if (process.platform === 'darwin') return;
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Startup update check failed:', err);
    });
  }, 4000);
}
