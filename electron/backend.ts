import { ChildProcess, spawn, spawnSync } from 'child_process';
import { app } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';
import { seedPythonCandidates, venvPythonPath } from './backendPython';

const PYTHON_VERSION = '3.12';
const DEPS_IMPORT = 'import fastapi, uvicorn, httpx, websockets';

export class BackendManager {
  private process: ChildProcess | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private startupTimeout: ReturnType<typeof setTimeout> | null = null;
  private isStarting = false;
  private restartAttempts = 0;
  public readonly port: number;

  readonly authToken: string;

  constructor(port: number = 8765, authToken?: string) {
    this.port = port;
    this.authToken =
      authToken ||
      process.env.NEXUM_AUTH_TOKEN ||
      (app.isPackaged ? crypto.randomBytes(32).toString('hex') : this.readOrCreateSharedToken());
    this.persistSharedToken(this.authToken);
  }

  private sharedTokenPath(): string {
    if (process.env.NEXUM_AUTH_TOKEN_FILE) return process.env.NEXUM_AUTH_TOKEN_FILE;
    return path.join(os.homedir(), '.nexum', 'backend-auth-token');
  }

  private readOrCreateSharedToken(): string {
    const file = this.sharedTokenPath();
    try {
      const existing = fs.readFileSync(file, 'utf8').trim();
      if (existing.length >= 16) return existing;
    } catch {
      /* first run */
    }
    const token = crypto.randomBytes(32).toString('hex');
    this.writeTokenFile(file, token);
    return token;
  }

  private persistSharedToken(token: string): void {
    this.writeTokenFile(this.sharedTokenPath(), token);
  }

  private writeTokenFile(file: string, token: string): void {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, token, { encoding: 'utf8', mode: 0o600 });
    } catch {
      /* ignore */
    }
  }

  private freePort(): void {
    this.log(`Freeing port ${this.port} so this app can start its own backend.`);
    if (process.platform === 'win32') {
      spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Get-NetTCPConnection -LocalPort ${this.port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
        ],
        { timeout: 8000, windowsHide: true },
      );
      return;
    }
    const result = spawnSync('lsof', ['-ti', `tcp:${this.port}`], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    const pids = String(result.stdout || '')
      .split(/\s+/)
      .map((n) => Number(n))
      .filter((n) => n > 0 && n !== process.pid);
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
    }
  }

  private getBackendRoot(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'backend');
    }
    return path.join(__dirname, '..', '..', 'backend');
  }

  private getBackendPath(): string {
    return path.join(this.getBackendRoot(), 'server.py');
  }

  private toolsDir(): string {
    return path.join(app.getPath('userData'), 'bin');
  }

  private venvDir(): string {
    return path.join(app.getPath('userData'), 'backend-venv');
  }

  private venvPython(): string {
    return venvPythonPath(this.venvDir(), process.platform);
  }

  private log(line: string): void {
    console.log(line);
    try {
      fs.appendFileSync(
        path.join(app.getPath('userData'), 'startup.log'),
        `${new Date().toISOString()} ${line}\n`,
      );
    } catch {
      /* ignore */
    }
  }

  private extraBinDirs(): string[] {
    const home = os.homedir();
    const dirs = [this.toolsDir()];
    if (process.platform === 'win32') {
      dirs.push(
        path.join(home, '.local', 'bin'),
        path.join(home, '.cargo', 'bin'),
        path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python313'),
        path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python312'),
        'C:\\Python313',
        'C:\\Python312',
      );
    } else {
      dirs.push(
        path.join(home, '.local', 'bin'),
        path.join(home, '.cargo', 'bin'),
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/Library/Frameworks/Python.framework/Versions/Current/bin',
        '/Library/Frameworks/Python.framework/Versions/3.13/bin',
        '/Library/Frameworks/Python.framework/Versions/3.12/bin',
        '/Library/Frameworks/Python.framework/Versions/3.11/bin',
      );
    }
    return dirs;
  }

  private withPythonPath(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const dirs = this.extraBinDirs().filter((dir) => fs.existsSync(dir));
    const current = env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin';
    return { ...env, PATH: [...dirs, current].join(path.delimiter) };
  }

  private run(command: string, args: string[], timeoutMs: number, extraEnv: NodeJS.ProcessEnv = {}): { ok: boolean; out: string } {
    this.log(`$ ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      cwd: this.getBackendRoot(),
      env: { ...this.withPythonPath(), ...extraEnv },
      windowsHide: true,
    });
    const out = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    if (out) this.log(`[uv] ${out.slice(-1200)}`);
    if (result.error) this.log(`command error: ${String(result.error)}`);
    return { ok: result.status === 0, out };
  }

  private probePython(command: string, code: string, timeoutMs: number): boolean {
    if (path.isAbsolute(command) && !fs.existsSync(command)) return false;
    const result = spawnSync(command, ['-c', code], {
      encoding: 'utf8',
      timeout: timeoutMs,
      env: this.withPythonPath(),
      windowsHide: true,
    });
    return result.status === 0;
  }

  private hasBackendDeps(command: string): boolean {
    return this.probePython(command, DEPS_IMPORT, 20_000);
  }

  private requirementsHash(): string {
    const req = path.join(this.getBackendRoot(), 'requirements.txt');
    const pyproject = path.join(this.getBackendRoot(), 'pyproject.toml');
    const chunks: Buffer[] = [];
    if (fs.existsSync(req)) chunks.push(fs.readFileSync(req));
    if (fs.existsSync(pyproject)) chunks.push(fs.readFileSync(pyproject));
    return crypto.createHash('sha256').update(Buffer.concat(chunks)).digest('hex').slice(0, 20);
  }

  private venvIsCurrent(): boolean {
    const py = this.venvPython();
    const marker = path.join(this.venvDir(), '.nexum-req');
    if (!fs.existsSync(py) || !this.hasBackendDeps(py)) return false;
    try {
      return fs.readFileSync(marker, 'utf8').trim() === this.requirementsHash();
    } catch {
      return false;
    }
  }

  private uvName(): string {
    return process.platform === 'win32' ? 'uv.exe' : 'uv';
  }

  private uvCandidates(): string[] {
    const named = this.uvName();
    const extras = this.extraBinDirs().map((dir) => path.join(dir, named));
    return [
      process.env.UV || '',
      path.join(this.toolsDir(), named),
      ...extras,
      named,
    ].filter(Boolean);
  }

  private findUv(): string | null {
    const tried: string[] = [];
    for (const command of this.uvCandidates()) {
      if (tried.includes(command)) continue;
      tried.push(command);
      if (path.isAbsolute(command) && !fs.existsSync(command)) continue;
      const result = spawnSync(command, ['--version'], {
        encoding: 'utf8',
        timeout: 8_000,
        env: this.withPythonPath(),
        windowsHide: true,
      });
      if (result.status === 0) {
        this.log(`Found uv: ${command} ${(result.stdout || '').trim()}`);
        return command;
      }
    }
    return null;
  }

  private bootstrapUv(): string | null {
    const dest = this.toolsDir();
    fs.mkdirSync(dest, { recursive: true });
    this.log(`Installing uv into ${dest}`);
    const env = {
      ...this.withPythonPath(),
      UV_INSTALL_DIR: dest,
      UV_NO_MODIFY_PATH: '1',
    };
    if (process.platform === 'win32') {
      this.run(
        'powershell',
        ['-ExecutionPolicy', 'Bypass', '-c', 'irm https://astral.sh/uv/install.ps1 | iex'],
        120_000,
        env,
      );
    } else {
      this.run('sh', ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh'], 120_000, env);
    }
    const bin = path.join(dest, this.uvName());
    if (fs.existsSync(bin)) return bin;
    return this.findUv();
  }

  private resolveUv(): string | null {
    return this.findUv() || this.bootstrapUv();
  }

  private markVenvCurrent(): void {
    try {
      fs.writeFileSync(path.join(this.venvDir(), '.nexum-req'), this.requirementsHash());
    } catch {
      /* ignore */
    }
  }

  private requirementsFile(): string {
    return path.join(this.getBackendRoot(), 'requirements.txt');
  }

  private clearVenv(): void {
    try {
      fs.rmSync(this.venvDir(), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  private installIntoVenv(py: string): boolean {
    const req = this.requirementsFile();
    if (!fs.existsSync(req)) {
      this.log('backend/requirements.txt is missing');
      return false;
    }
    this.log(`Installing backend deps into ${py}`);
    let result = this.run(py, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', req], 180_000);
    if (!result.ok) {
      this.log('venv pip missing; trying ensurepip');
      this.run(py, ['-m', 'ensurepip', '--upgrade'], 60_000);
      result = this.run(py, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', req], 180_000);
    }
    return result.ok && this.hasBackendDeps(py);
  }

  private finishVenv(py: string, via: string): string | null {
    if (!this.hasBackendDeps(py) && !this.installIntoVenv(py)) {
      this.log(`${via} env is missing fastapi/uvicorn/httpx/websockets`);
      return null;
    }
    this.markVenvCurrent();
    this.log(`Using ${via} venv ${py}`);
    return py;
  }

  private ensureUvEnv(uv: string): string | null {
    const venvDir = this.venvDir();
    const py = this.venvPython();
    if (this.venvIsCurrent()) {
      this.log(`Using uv venv ${py}`);
      return py;
    }
    this.run(uv, ['python', 'install', PYTHON_VERSION], 180_000);
    if (!fs.existsSync(py)) {
      fs.mkdirSync(path.dirname(venvDir), { recursive: true });
      this.run(uv, ['venv', '--python', PYTHON_VERSION, venvDir], 120_000);
    }
    if (!fs.existsSync(py)) {
      this.log('uv venv did not create a Python interpreter; recreating');
      this.clearVenv();
      this.run(uv, ['venv', '--python', PYTHON_VERSION, venvDir], 120_000);
    }
    if (!fs.existsSync(py)) {
      this.log('uv venv did not create a Python interpreter');
      return null;
    }
    const req = this.requirementsFile();
    if (fs.existsSync(req)) {
      this.run(uv, ['pip', 'install', '-r', req, '--python', py], 180_000);
    }
    return this.finishVenv(py, 'uv');
  }

  private seedPythons(): string[] {
    return seedPythonCandidates({
      isPackaged: app.isPackaged,
      backendRoot: this.getBackendRoot(),
      extraBinDirs: this.extraBinDirs(),
      platform: process.platform,
      env: process.env,
    });
  }

  private createStdlibVenv(seed: string): boolean {
    this.log(`Creating userData venv with ${seed} -m venv`);
    this.clearVenv();
    fs.mkdirSync(path.dirname(this.venvDir()), { recursive: true });
    return this.run(seed, ['-m', 'venv', this.venvDir()], 90_000).ok && fs.existsSync(this.venvPython());
  }

  private ensureStdlibVenv(): string | null {
    const py = this.venvPython();
    const tried: string[] = [];
    for (const seed of this.seedPythons()) {
      if (tried.includes(seed)) continue;
      tried.push(seed);
      if (!this.probePython(seed, 'import sys; print(sys.version)', 8_000)) continue;
      if (!fs.existsSync(py) && !this.createStdlibVenv(seed)) continue;
      const ready = this.finishVenv(py, 'stdlib');
      if (ready) return ready;
      if (!this.createStdlibVenv(seed)) continue;
      const retry = this.finishVenv(py, 'stdlib');
      if (retry) return retry;
    }
    return null;
  }

  private resolvePython(): string {
    if (this.venvIsCurrent()) {
      this.log(`Using userData venv ${this.venvPython()}`);
      return this.venvPython();
    }

    const uv = this.resolveUv();
    if (uv) {
      const fromUv = this.ensureUvEnv(uv);
      if (fromUv) return fromUv;
      this.log('uv could not prepare userData venv; trying python -m venv');
    }

    const fromStdlib = this.ensureStdlibVenv();
    if (fromStdlib) return fromStdlib;

    for (const command of this.seedPythons()) {
      if (this.hasBackendDeps(command)) {
        this.log(`Using existing Python with deps ${command}`);
        return command;
      }
    }

    throw new Error(
      'Python backend is not ready. Nexum installs its own packages into app data; it will not pip-install into Homebrew Python. Reopen the app after a network connection is available, or install uv from https://docs.astral.sh/uv/.',
    );
  }

  async start(): Promise<void> {
    if (this.isStarting || this.process) {
      console.log('Backend is already running or starting');
      return;
    }

    const status = await this.checkHealthStatus();
    if (status === 200) {
      console.log(`Backend already listening on port ${this.port}; not starting another.`);
      this.startHealthPolling();
      return;
    }
    if (status === 401) {
      this.log(
        `Port ${this.port} has a backend with a different auth token. Replacing it.`,
      );
      this.freePort();
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    this.isStarting = true;
    const serverScript = this.getBackendPath();
    let pythonCommand: string;
    try {
      pythonCommand = this.resolvePython();
    } catch (err) {
      this.isStarting = false;
      this.log(`Python not ready: ${String(err)}`);
      throw err;
    }

    this.log(`Starting backend from: ${serverScript}`);
    this.log(`Python command: ${pythonCommand}`);

    try {
      this.process = spawn(pythonCommand, [serverScript], {
        cwd: this.getBackendRoot(),
        env: {
          ...this.withPythonPath(),
          PORT: String(this.port),
          NEXUM_USER_DATA: app.getPath('userData'),
          NEXUM_AUTH_TOKEN: this.authToken,
          PYTHONFAULTHANDLER: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.process.on('error', (err) => {
        this.log(`Backend process error: ${String(err)}`);
        this.handleCrash();
      });

      this.process.on('exit', (code, signal) => {
        console.error(`Backend exited with code ${code}, signal ${signal}`);
        this.process = null;
        this.checkHealth().then((healthy) => {
          if (healthy) {
            console.log(`Port ${this.port} is still served; leaving it alone.`);
            return;
          }
          this.handleCrash();
        });
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.log(`[backend] ${data.toString().trim()}`);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        this.log(`[backend] ${data.toString().trim()}`);
      });

      await this.waitForHealth(90_000);
      this.startHealthPolling();
      this.restartAttempts = 0;
      this.isStarting = false;
    } catch (err) {
      this.isStarting = false;
      throw err;
    }
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }

    if (this.process) {
      console.log('Stopping backend...');
      this.process.kill('SIGTERM');

      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);

      this.process = null;
    }
  }

  /** Returns the raw /health status code, 0 if unreachable. */
  async checkHealthStatus(): Promise<number> {
    return new Promise((resolve) => {
      const req = http.get(
        `http://127.0.0.1:${this.port}/health`,
        { headers: { 'x-nexum-token': this.authToken } },
        (res) => {
          const code = res.statusCode || 0;
          res.resume();
          resolve(code);
        },
      );

      req.on('error', () => {
        resolve(0);
      });

      req.setTimeout(3000, () => {
        req.destroy();
        resolve(0);
      });
    });
  }

  async checkHealth(): Promise<boolean> {
    return (await this.checkHealthStatus()) === 200;
  }

  private async waitForHealth(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 500;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        const elapsed = Date.now() - startTime;

        if (elapsed >= timeoutMs) {
          reject(new Error(`Backend failed to start within ${timeoutMs}ms`));
          return;
        }

        const healthy = await this.checkHealth();
        if (healthy) {
          resolve();
          return;
        }

        setTimeout(poll, pollInterval);
      };

      poll();
    });
  }

  private startHealthPolling(): void {
    if (this.healthCheckInterval) return;
    this.healthCheckInterval = setInterval(async () => {
      const healthy = await this.checkHealth();
      if (!healthy) {
        console.warn('Backend health check failed, attempting restart...');
        this.handleCrash();
      }
    }, 30_000);
  }

  private handleCrash(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.process) {
      this.process = null;
    }

    if (this.restartAttempts >= 5) {
      console.error('Backend restart capped after 5 attempts — waiting for app reload to retry');
      return;
    }
    this.restartAttempts += 1;
    const delay = Math.min(48000, 3000 * Math.pow(2, this.restartAttempts - 1));
    console.log(`Attempting to restart backend in ${delay}ms (attempt ${this.restartAttempts}/5)...`);
    setTimeout(() => {
      this.start().catch((err) => {
        console.error('Failed to restart backend:', err);
      });
    }, delay);
  }
}
