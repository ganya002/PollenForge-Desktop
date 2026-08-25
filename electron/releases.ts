import { app, net, shell } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export const GITHUB_OWNER = 'ganya002';
export const GITHUB_REPO = 'PollenForge-Desktop';

const USER_AGENT = 'Nexum-Desktop';
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

export function compareVersions(a: string, b: string): number {
  const pa = normalizeVersion(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = normalizeVersion(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export function matchReleaseAsset(
  assets: ReleaseAsset[],
  platform: NodeJS.Platform = process.platform,
): ReleaseAsset | null {
  const usable = assets.filter((a) => !a.name.includes('blockmap') && !a.name.endsWith('.yml'));

  if (platform === 'darwin') {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const archDmg = usable.find((a) => a.name.includes(`Mac-${arch}`) && a.name.endsWith('.dmg'));
    const anyDmg = usable.find((a) => a.name.endsWith('.dmg'));
    const archZip = usable.find((a) => a.name.includes(`Mac-${arch}`) && a.name.endsWith('.zip'));
    return archDmg || anyDmg || archZip || usable.find((a) => a.name.endsWith('.zip')) || null;
  }

  if (platform === 'win32') {
    return usable.find((a) => /windows-setup\.exe$/i.test(a.name))
      || usable.find((a) => /setup.*\.exe$/i.test(a.name))
      || usable.find((a) => a.name.endsWith('.exe'))
      || usable.find((a) => /windows\.zip$/i.test(a.name))
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

async function verifyChecksum(destPath: string, assetName: string, releases: AppRelease[]): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Find SHA256SUMS asset in any release (prefer same tag, fallback to latest)
    const all = releases;
    // First try same tag's SHA256SUMS
    let sumsAsset: ReleaseAsset | null = null;
    let sumsTag: string | null = null;
    // Need raw GithubReleaseJson to locate SHA256SUMS — refetch with asset list
    // Instead, search already-fetched listReleases for asset matching pattern
    // listReleases already filtered blockmap/yml but we need original payload — so re-fetch raw
    const res = await net.fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': USER_AGENT, 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (res.ok) {
      const payload = (await res.json()) as GithubReleaseJson[];
      for (const rel of payload) {
        if (rel.tag_name === all.find((r) => r.asset?.name === assetName)?.tag) {
          const found = (rel.assets || []).find((a) => a.name.toLowerCase().includes('sha256sums'));
          if (found) {
            sumsAsset = { name: found.name, browser_download_url: found.browser_download_url, size: found.size };
            sumsTag = rel.tag_name;
            break;
          }
        }
      }
      if (!sumsAsset) {
        for (const rel of payload) {
          const found = (rel.assets || []).find((a) => a.name.toLowerCase().includes('sha256sums'));
          if (found) {
            sumsAsset = { name: found.name, browser_download_url: found.browser_download_url, size: found.size };
            sumsTag = rel.tag_name;
            break;
          }
        }
      }
    }
    if (!sumsAsset) {
      // No checksum file published yet (older releases) — allow but log
      console.warn(`No SHA256SUMS asset found for ${assetName} — skipping checksum verification`);
      return { ok: true };
    }
    const tmpSums = path.join(app.getPath('temp'), 'nexum-updates', `SHA256SUMS-${sumsTag || 'latest'}.txt`);
    await followDownload(sumsAsset.browser_download_url, tmpSums, undefined, 5);
    const sumsContent = fs.readFileSync(tmpSums, 'utf-8');
    // Expected format: "<sha256>  <filename>" per line
    let expected: string | null = null;
    for (const line of sumsContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const hash = parts[0].toLowerCase();
        const fname = parts.slice(1).join(' ').replace(/^\*/, '').trim();
        if (fname === assetName) {
          expected = hash;
          break;
        }
      }
    }
    if (!expected) {
      console.warn(`No checksum entry for ${assetName} in ${sumsAsset.name} — skipping`);
      return { ok: true };
    }
    const fileBuffer = fs.readFileSync(destPath);
    const actual = crypto.createHash('sha256').update(fileBuffer).digest('hex').toLowerCase();
    if (actual !== expected) {
      try { fs.unlinkSync(destPath); } catch {}
      return { ok: false, error: `Checksum mismatch for ${assetName}: expected ${expected.slice(0, 8)}…, got ${actual.slice(0, 8)}… — download may be corrupted or tampered.` };
    }
    return { ok: true };
  } catch (err: any) {
    console.warn('Checksum verification failed (non-fatal):', err?.message || err);
    return { ok: true };
  }
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

    const dest = path.join(app.getPath('temp'), 'nexum-updates', release.asset.name);
    await downloadReleaseAsset(release.asset, dest, onProgress);

    const verified = await verifyChecksum(dest, release.asset.name, releases);
    if (!(verified as { ok: boolean }).ok) {
      return { ok: false, error: (verified as { error: string }).error };
    }

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
