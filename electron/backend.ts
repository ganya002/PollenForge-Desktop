import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as http from 'http';

export class BackendManager {
  private process: ChildProcess | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private startupTimeout: ReturnType<typeof setTimeout> | null = null;
  private isStarting = false;
  public readonly port: number;

  constructor(port: number = 8765) {
    this.port = port;
  }

  private getBackendPath(): string {
    // __dirname is dist-electron/electron/ — go up to project root
    return path.join(__dirname, '..', '..', 'backend', 'server.py');
  }

  private getPythonCommand(): string {
    // Use the bundled venv if available, otherwise fall back to system python
    const venvPython = path.join(__dirname, '..', '..', 'backend', '.venv', 'bin', 'python');
    try {
      const fs = require('fs');
      if (fs.existsSync(venvPython)) {
        return venvPython;
      }
    } catch {}
    if (process.platform === 'win32') {
      return 'python';
    }
    return 'python3';
  }

  async start(): Promise<void> {
    if (this.isStarting || this.process) {
      console.log('Backend is already running or starting');
      return;
    }

    this.isStarting = true;
    const serverScript = this.getBackendPath();

    console.log(`Starting backend from: ${serverScript}`);
    console.log(`Python command: ${this.getPythonCommand()}`);

    try {
      this.process = spawn(this.getPythonCommand(), [serverScript], {
        env: {
          ...process.env,
          PORT: String(this.port),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.process.on('error', (err) => {
        console.error('Backend process error:', err);
        this.handleCrash();
      });

      this.process.on('exit', (code, signal) => {
        console.error(`Backend exited with code ${code}, signal ${signal}`);
        this.process = null;
        this.handleCrash();
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        console.log(`[backend] ${data.toString().trim()}`);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        console.error(`[backend] ${data.toString().trim()}`);
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
    this.healthCheckInterval = setInterval(async () => {
      const healthy = await this.checkHealth();
      if (!healthy && this.process) {
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
