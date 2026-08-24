import { ChildProcess, spawn, spawnSync } from 'child_process';
import { app } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';

const PYTHON_VERSION = '3.12';
const DEPS_IMPORT = 'import fastapi, uvicorn, httpx, websockets';

export class BackendManager {
  private process: ChildProcess | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private startupTimeout: ReturnType<typeof setTimeout> | null = null;
  private isStarting = false;
  public readonly port: number;

  constructor(port: number = 8765) {
    this.port = port;
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
    return process.platform === 'win32'
      ? path.join(this.venvDir(), 'Scripts', 'python.exe')
      : path.join(this.venvDir(), 'bin', 'python');
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

  private ensureUvEnv(uv: string): string | null {
    const venvDir = this.venvDir();
    const py = this.venvPython();
    if (this.venvIsCurrent()) {
      this.log(`Using uv venv ${py}`);
      return py;
    }
    fs.mkdirSync(venvDir, { recursive: true });
    const req = path.join(this.getBackendRoot(), 'requirements.txt');
    const lock = path.join(this.getBackendRoot(), 'uv.lock');
    const pyproject = path.join(this.getBackendRoot(), 'pyproject.toml');
    this.run(uv, ['python', 'install', PYTHON_VERSION], 180_000);
    if (!fs.existsSync(py)) {
      this.run(uv, ['venv', '--python', PYTHON_VERSION, venvDir], 120_000);
    }
    if (!fs.existsSync(py)) {
      this.log('uv venv did not create a Python interpreter');
      return null;
    }
    const env = { UV_PROJECT_ENVIRONMENT: venvDir };
    let installed = false;
    if (fs.existsSync(pyproject) && fs.existsSync(lock)) {
      installed = this.run(
        uv,
        ['sync', '--directory', this.getBackendRoot(), '--python', PYTHON_VERSION, '--frozen'],
        180_000,
        env,
      ).ok;
    }
    if (!installed && fs.existsSync(pyproject)) {
      installed = this.run(
        uv,
        ['sync', '--directory', this.getBackendRoot(), '--python', PYTHON_VERSION],
        180_000,
        env,
      ).ok;
    }
    if (!installed && fs.existsSync(req)) {
      installed = this.run(uv, ['pip', 'install', '-r', req, '--python', py], 180_000).ok;
    }
    if (!this.hasBackendDeps(py)) {
      this.log('uv env is missing fastapi/uvicorn/httpx/websockets');
      return null;
    }
    try {
      fs.writeFileSync(path.join(venvDir, '.nexum-req'), this.requirementsHash());
    } catch {
      /* ignore */
    }
    this.log(`Using uv venv ${py}${installed ? '' : ' (deps already present)'}`);
    return py;
  }

  private pythonCandidates(): string[] {
    const root = this.getBackendRoot();
    const venvPython = process.platform === 'win32'
      ? path.join(root, '.venv', 'Scripts', 'python.exe')
      : path.join(root, '.venv', 'bin', 'python');
    const extras = this.extraBinDirs().map((dir) => path.join(dir, process.platform === 'win32' ? 'python.exe' : 'python3'));
    return [
      this.venvPython(),
      venvPython,
      process.env.PYTHON3 || '',
      process.env.PYTHON || '',
      ...extras,
      process.platform === 'win32' ? 'python' : 'python3',
      'python',
    ].filter(Boolean);
  }

  private installBackendDeps(command: string): void {
    const req = path.join(this.getBackendRoot(), 'requirements.txt');
    if (!fs.existsSync(req)) return;
    this.log(`Installing backend deps with ${command} -m pip`);
    const result = spawnSync(command, ['-m', 'pip', 'install', '-r', req], {
      encoding: 'utf8',
      timeout: 180_000,
      cwd: this.getBackendRoot(),
      env: this.withPythonPath(),
      windowsHide: true,
    });
    if (result.stdout) this.log(`[pip] ${result.stdout.trim().slice(-800)}`);
    if (result.stderr) this.log(`[pip] ${result.stderr.trim().slice(-800)}`);
    if (result.status !== 0) this.log(`pip install exited ${result.status}`);
  }

  private resolvePython(): string {
    const uv = this.resolveUv();
    if (uv) {
      const fromUv = this.ensureUvEnv(uv);
      if (fromUv) return fromUv;
      this.log('uv could not prepare the backend; falling back to system Python');
    }

    const tried: string[] = [];
    let installer: string | null = null;
    for (const command of this.pythonCandidates()) {
      if (tried.includes(command)) continue;
      tried.push(command);
      if (!this.probePython(command, 'import sys; print(sys.version)', 8_000)) continue;
      if (this.hasBackendDeps(command)) {
        this.log(`Using Python ${command}`);
        return command;
      }
      installer = installer || command;
    }
    if (installer) {
      this.installBackendDeps(installer);
      if (this.hasBackendDeps(installer)) {
        this.log(`Using Python ${installer} after pip install`);
        return installer;
      }
    }
    throw new Error(
      'Python backend is not ready. Install uv from https://docs.astral.sh/uv/ (or Python 3), then reopen Nexum.',
    );
  }

  async start(): Promise<void> {
    if (this.isStarting || this.process) {
      console.log('Backend is already running or starting');
      return;
    }

    if (await this.checkHealth()) {
      console.log(`Backend already listening on port ${this.port}; not starting another.`);
      this.startHealthPolling();
      return;
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

      await this.waitForHealth(45_000);
      this.startHealthPolling();
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

  async checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/health`, (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(3000, () => {
        req.destroy();
        resolve(false);
      });
    });
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

    console.log('Attempting to restart backend in 3 seconds...');
    setTimeout(() => {
      this.start().catch((err) => {
        console.error('Failed to restart backend:', err);
      });
    }, 3000);
  }
}
