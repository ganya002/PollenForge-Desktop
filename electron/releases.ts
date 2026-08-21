import { app, net, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export const GITHUB_OWNER = 'ganya002';
export const GITHUB_REPO = 'PollenForge-Desktop';

const USER_AGENT = 'PollenForge-Desktop';
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=50`;

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface AppRelease {
  tag: string;
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  prerelease: boolean;
  htmlUrl: string;
  asset: ReleaseAsset | null;
}

export function normalizeVersion(tag: string): string {
  return tag.replace(/^v/i, '');
}

export function matchReleaseAsset(
  assets: ReleaseAsset[],
  platform: NodeJS.Platform = process.platform,
): ReleaseAsset | null {
  const usable = assets.filter((a) => !a.name.includes('blockmap') && !a.name.endsWith('.yml'));

  if (platform === 'darwin') {
    return usable.find((a) => a.name.endsWith('.dmg'))
      || usable.find((a) => a.name.endsWith('.zip'))
      || null;
  }

  if (platform === 'win32') {
    return usable.find((a) => /setup.*\.exe$/i.test(a.name))
      || usable.find((a) => a.name.endsWith('.exe'))
      || usable.find((a) => a.name.endsWith('.zip'))
      || null;
  }

  return usable.find((a) => a.name.endsWith('.AppImage'))
    || usable.find((a) => a.name.endsWith('.deb'))
    || null;
}

interface GithubReleaseJson {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export async function listReleases(): Promise<AppRelease[]> {
  const response = await net.fetch(RELEASES_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases request failed (${response.status})`);
  }

  const payload = (await response.json()) as GithubReleaseJson[];
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected GitHub Releases response');
  }

  return payload
    .filter((release) => !release.draft)
    .map((release) => {
      const assets: ReleaseAsset[] = (release.assets || []).map((asset) => ({
        name: asset.name,
        browser_download_url: asset.browser_download_url,
        size: asset.size,
      }));
      return {
        tag: release.tag_name,
        version: normalizeVersion(release.tag_name),
        name: release.name || release.tag_name,
        body: release.body || '',
        publishedAt: release.published_at,
        prerelease: release.prerelease,
        htmlUrl: release.html_url,
        asset: matchReleaseAsset(assets),
      };
    });
}

export async function downloadReleaseAsset(
  asset: ReleaseAsset,
  destPath: string,
  onProgress?: (percent: number, transferred: number, total: number) => void,
): Promise<void> {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await followDownload(asset.browser_download_url, destPath, onProgress, 5);
}

function followDownload(
  url: string,
  destPath: string,
  onProgress: ((percent: number, transferred: number, total: number) => void) | undefined,
  redirectsLeft: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          Accept: 'application/octet-stream',
          'User-Agent': USER_AGENT,
        },
      },
      (response) => {
        const code = response.statusCode || 0;
        const location = response.headers.location;
        if (code >= 300 && code < 400 && location) {
          response.resume();
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects while downloading release'));
            return;
          }
          const next = new URL(location, url).toString();
          followDownload(next, destPath, onProgress, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        writeDownload(response, destPath, onProgress, resolve, reject);
      },
    ).on('error', reject);
  });
}

function writeDownload(
  response: import('http').IncomingMessage,
  destPath: string,
  onProgress: ((percent: number, transferred: number, total: number) => void) | undefined,
  resolve: () => void,
  reject: (err: Error) => void,
): void {
  if (!response.statusCode || response.statusCode >= 400) {
    reject(new Error(`Download failed (${response.statusCode || 0})`));
    response.resume();
    return;
  }

  const total = Number(response.headers['content-length'] || 0);
  let transferred = 0;
  const file = fs.createWriteStream(destPath);

  response.on('data', (chunk: Buffer) => {
    transferred += chunk.length;
    if (onProgress) {
      const percent = total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0;
      onProgress(percent, transferred, total);
    }
  });

  response.pipe(file);
  file.on('finish', () => {
    file.close();
    resolve();
  });
  file.on('error', (err) => {
    file.close();
    fs.unlink(destPath, () => reject(err));
  });
  response.on('error', (err) => {
    file.close();
    fs.unlink(destPath, () => reject(err));
  });
}

export async function installReleaseVersion(
  tag: string,
  onProgress?: (percent: number, transferred: number, total: number) => void,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  try {
    const releases = await listReleases();
    const release = releases.find((item) => item.tag === tag || item.version === normalizeVersion(tag));
    if (!release) {
      return { ok: false, error: `Release ${tag} was not found.` };
    }
    if (!release.asset) {
      return { ok: false, error: `No installer for this platform in ${release.tag}.` };
    }

    const dest = path.join(app.getPath('temp'), 'pollenforge-updates', release.asset.name);
    await downloadReleaseAsset(release.asset, dest, onProgress);

    const openError = await shell.openPath(dest);
    if (openError) {
      return { ok: false, error: openError };
    }

    setTimeout(() => app.quit(), 800);
    return { ok: true, path: dest };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to install that version.' };
  }
}
