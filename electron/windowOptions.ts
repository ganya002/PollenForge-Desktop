import { BrowserWindowConstructorOptions, Rectangle } from 'electron';
import * as path from 'path';

const BACKGROUND = '#0a0a0a';

/** Chromium switches that must be applied before app.ready(). */
export function windowsChromiumSwitches(): Array<[string, string?]> {
  return [
    ['disable-features', 'CalculateNativeWinOcclusion'],
  ];
}

export function resolveRenderer(
  isPackaged: boolean,
  appPath: string
): { kind: 'url'; url: string } | { kind: 'file'; file: string } {
  if (!isPackaged) {
    return { kind: 'url', url: 'http://localhost:5173' };
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
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  };

  if (platform === 'darwin') {
    return {
      ...base,
      frame: false,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
    };
  }

  // Native Windows chrome so the window can still be moved/maximized
  // if the GPU compositor fails.
  return {
    ...base,
    frame: true,
  };
}
