import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function preview(messages: unknown[]): string {
  if (!Array.isArray(messages)) return '';
  for (const item of messages) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { role?: string; content?: string };
    if (row.role !== 'user') continue;
    const text = String(row.content || '').trim();
    if (text) return text.slice(0, 200);
  }
  return '';
}

export function sessionsDir(userData: string): string {
  const dir = path.join(userData, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function atomicWriteFile(filePath: string, contents: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

export function summarizeSessionFile(filePath: string): Record<string, unknown> | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    const meta = (raw.meta && typeof raw.meta === 'object' ? raw.meta : {}) as Record<string, unknown>;
    const messages = Array.isArray(raw.messages) ? raw.messages : [];
    const updated = typeof meta.updated_at === 'number' ? meta.updated_at : 0;
    const stat = fs.statSync(filePath);
    return {
      id: path.basename(filePath, '.json'),
      name: typeof meta.name === 'string' && meta.name ? meta.name : 'Untitled',
      message_count: messages.length,
      updated_at: updated,
      modified: updated ? new Date(updated > 1e12 ? updated : updated * 1000).toISOString() : stat.mtime.toISOString(),
      directory: typeof meta.directory === 'string' ? meta.directory : '',
      preview: preview(messages),
      pinned: !!meta.pinned,
      archived: !!meta.archived,
    };
  } catch {
    return null;
  }
}

export function listSessionSummaries(userData: string): Record<string, unknown>[] {
  const dir = sessionsDir(userData);
  const sessions = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json') && !name.startsWith('.'))
    .map((name) => summarizeSessionFile(path.join(dir, name)))
    .filter((item): item is Record<string, unknown> => Boolean(item));
  sessions.sort((a, b) => {
    const pin = Number(!!b.pinned) - Number(!!a.pinned);
    if (pin) return pin;
    return Number(b.updated_at || 0) - Number(a.updated_at || 0);
  });
  return sessions;
}

const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;

function validatedId(id: string): string {
  const clean = (id || '').trim();
  if (!ID_RE.test(clean)) throw new Error('invalid session id');
  return clean;
}

function sessionFilePath(userData: string, id: string): string {
  const safeId = validatedId(id);
  const dir = sessionsDir(userData);
  const filePath = path.join(dir, `${safeId}.json`);
  // Containment check — resolve symlinks where possible
  try {
    const realDir = fs.realpathSync(dir);
    const realFile = path.resolve(filePath);
    // realFile must be inside realDir (or exactly the dir + file)
    if (realFile !== realDir && !realFile.startsWith(realDir + path.sep)) {
      throw new Error('path escape');
    }
  } catch {
    // If realpath fails (file doesn't exist yet), fall back to path check
    const resolved = path.resolve(filePath);
    const resolvedDir = path.resolve(dir);
    if (resolved !== resolvedDir && !resolved.startsWith(resolvedDir + path.sep)) {
      throw new Error('path escape');
    }
  }
  return filePath;
}

export function loadSessionFile(userData: string, id: string): unknown {
  const filePath = sessionFilePath(userData, id);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function saveSessionFile(userData: string, id: string, data: unknown): void {
  const filePath = sessionFilePath(userData, id);
  atomicWriteFile(filePath, JSON.stringify(data, null, 2));
}

export function deleteSessionFile(userData: string, id: string): void {
  try {
    const filePath = sessionFilePath(userData, id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Invalid id — nothing to delete
  }
}

export function legacySessionDirs(home = os.homedir()): string[] {
  return [
    path.join(home, 'Library', 'Application Support', 'Nexum', 'sessions'),
    path.join(home, 'Library', 'Application Support', 'nexum', 'sessions'),
    path.join(home, 'Library', 'Application Support', 'pollenforge', 'sessions'),
    path.join(home, 'AppData', 'Roaming', 'Nexum', 'sessions'),
    path.join(home, 'AppData', 'Roaming', 'nexum', 'sessions'),
    path.join(home, '.local', 'share', 'nexum', 'sessions'),
    path.join(home, '.local', 'share', 'pollenforge', 'sessions'),
  ];
}

export function importLegacySessions(userData: string, home = os.homedir()): number {
  const dest = sessionsDir(userData);
  let copied = 0;
  for (const source of legacySessionDirs(home)) {
    let resolvedSrc = '';
    let resolvedDest = '';
    try {
      resolvedSrc = fs.realpathSync(source);
      resolvedDest = fs.realpathSync(dest);
    } catch {
      resolvedSrc = path.resolve(source);
      resolvedDest = path.resolve(dest);
    }
    if (resolvedSrc === resolvedDest || !fs.existsSync(source) || !fs.statSync(source).isDirectory()) continue;
    for (const name of fs.readdirSync(source)) {
      if (!name.endsWith('.json') || name.startsWith('.')) continue;
      const from = path.join(source, name);
      const to = path.join(dest, name);
      if (fs.existsSync(to) || !fs.statSync(from).isFile()) continue;
      fs.copyFileSync(from, to);
      copied += 1;
    }
  }
  return copied;
}
