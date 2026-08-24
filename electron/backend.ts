import { ChildProcess, spawn, spawnSync } from 'child_process';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';

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
    if (process.platform === 'win32') {
      return [
        path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python313'),
        path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python312'),
        'C:\\Python313',
        'C:\\Python312',
      ];
    }
    return [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/Library/Frameworks/Python.framework/Versions/Current/bin',
      '/Library/Frameworks/Python.framework/Versions/3.13/bin',
      '/Library/Frameworks/Python.framework/Versions/3.12/bin',
      '/Library/Frameworks/Python.framework/Versions/3.11/bin',
      path.join(home, '.local', 'bin'),
    ];
  }

  private withPythonPath(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const dirs = this.extraBinDirs().filter((dir) => fs.existsSync(dir));
    const current = env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin';
    return { ...env, PATH: [...dirs, current].join(path.delimiter) };
  }

  private pythonCandidates(): string[] {
    const root = this.getBackendRoot();
    const venvPython = process.platform === 'win32'
      ? path.join(root, '.venv', 'Scripts', 'python.exe')
      : path.join(root, '.venv', 'bin', 'python');
    const extras = this.extraBinDirs().map((dir) => path.join(dir, process.platform === 'win32' ? 'python.exe' : 'python3'));
    return [
      venvPython,
      process.env.PYTHON3 || '',
      process.env.PYTHON || '',
      ...extras,
      process.platform === 'win32' ? 'python' : 'python3',
      'python',
    ].filter(Boolean);
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
    return this.probePython(command, 'import fastapi, uvicorn, httpx', 20_000);
  }

  private installBackendDeps(command: string): void {
    const req = path.join(this.getBackendRoot(), 'requirements.txt');
    if (!fs.existsSync(req)) return;
    this.log(`Installing backend deps with ${command}`);
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
      'Python 3 with fastapi is required. Install Python 3 from python.org or brew, then reopen Nexum.',
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

      await this.waitForHealth(30_000);
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
