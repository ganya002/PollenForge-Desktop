import { BrowserWindowConstructorOptions, Rectangle } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const BACKGROUND = '#111111';

/** Chromium switches that must be applied before app.ready(). */
export function windowsChromiumSwitches(): Array<[string, string?]> {
  return [
    ['disable-features', 'CalculateNativeWinOcclusion'],
    ['disable-gpu-sandbox'],
    ['in-process-gpu'],
  ];
}

export function resolveRenderer(
  isPackaged: boolean,
  appPath: string,
  resourcesPath?: string
): { kind: 'url'; url: string } | { kind: 'file'; file: string } {
  if (!isPackaged) {
    return { kind: 'url', url: 'http://localhost:5173' };
  }
  const unpacked = resourcesPath
    ? path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'index.html')
    : '';
  if (unpacked && fs.existsSync(unpacked)) {
    return { kind: 'file', file: unpacked };
  }
  return { kind: 'file', file: path.join(appPath, 'dist', 'index.html') };
}

export function clampWindowBounds(
  bounds: { x?: number; y?: number; width: number; height: number },
  displays: Array<{ workArea: Rectangle }>
): { x?: number; y?: number; width: number; height: number } {
  const width = Math.min(Math.max(bounds.width, 800), 4000);
  const height = Math.min(Math.max(bounds.height, 600), 3000);
  if (bounds.x === undefined || bounds.y === undefined || displays.length === 0) {
    return { width, height };
  }
  const x = bounds.x;
  const y = bounds.y;
  const visible = displays.some(({ workArea }) => {
    return x + width > workArea.x
      && y + height > workArea.y
      && x < workArea.x + workArea.width
      && y < workArea.y + workArea.height;
  });
  if (!visible) return { width, height };
  return { x, y, width, height };
}

export function browserWindowOptions(
  platform: NodeJS.Platform,
  bounds: Pick<BrowserWindowConstructorOptions, 'x' | 'y' | 'width' | 'height'>
): BrowserWindowConstructorOptions {
  const base: BrowserWindowConstructorOptions = {
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: BACKGROUND,
    show: platform === 'win32',
    autoHideMenuBar: true,
    webPreferences: {
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  };

  if (platform === 'darwin') {
    return {
      ...base,
      show: false,
      frame: false,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
    };
  }

  return {
    ...base,
    frame: true,
  };
}