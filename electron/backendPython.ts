import * as path from 'path';

export function venvPythonPath(venvDir: string, platform: NodeJS.Platform): string {
  return platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');
}

export function bundleVenvPython(backendRoot: string, platform: NodeJS.Platform): string {
  return venvPythonPath(path.join(backendRoot, '.venv'), platform);
}

/** Interpreters that may *create* a private venv. Never pip-install into these. */
export function seedPythonCandidates(opts: {
  isPackaged: boolean;
  backendRoot: string;
  extraBinDirs: string[];
  platform: NodeJS.Platform;
  env: { PYTHON3?: string; PYTHON?: string; [key: string]: string | undefined };
}): string[] {
  const names = opts.platform === 'win32' ? ['python.exe', 'python3.exe', 'python'] : ['python3.12', 'python3.13', 'python3', 'python'];
  const extras = opts.extraBinDirs.flatMap((dir) => names.map((name) => path.join(dir, name)));
  const out: string[] = [];
  if (!opts.isPackaged) out.push(bundleVenvPython(opts.backendRoot, opts.platform));
  if (opts.env.PYTHON3) out.push(opts.env.PYTHON3);
  if (opts.env.PYTHON) out.push(opts.env.PYTHON);
  out.push(...extras);
  if (opts.platform === 'win32') out.push('python');
  else out.push('python3', 'python');
  return [...new Set(out.filter(Boolean))];
}
