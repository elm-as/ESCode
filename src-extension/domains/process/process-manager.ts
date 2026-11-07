import * as net from "net";
import { spawn, ChildProcess, exec } from "child_process";

export interface ProcessRunOptions {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  onExit?: (code: number | null) => void;
}

export class ExtensionProcessManager {
  private activeProcesses: Map<string, ChildProcess> = new Map();

  /**
   * Finds an available dynamic TCP port on 127.0.0.1 without collisions.
   */
  async allocateFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address && typeof address === "object") {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error("Unable to read port address")));
        }
      });
    });
  }

  startProcess(options: ProcessRunOptions): ChildProcess {
    this.stopProcess(options.id);

    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.trim() && options.onStdout) options.onStdout(line);
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.trim() && options.onStderr) options.onStderr(line);
      }
    });

    child.on("exit", (code: number | null) => {
      this.activeProcesses.delete(options.id);
      if (options.onExit) options.onExit(code);
    });

    this.activeProcesses.set(options.id, child);
    return child;
  }

  /**
   * Writes a command or JSON-RPC message directly to a running process's stdin.
   */
  writeStdin(id: string, input: string): boolean {
    const child = this.activeProcesses.get(id);
    if (!child || !child.stdin || !child.stdin.writable) {
      return false;
    }
    child.stdin.write(input);
    return true;
  }

  stopProcess(id: string): void {
    const child = this.activeProcesses.get(id);
    if (!child || !child.pid) return;

    if (process.platform === "win32") {
      exec(`taskkill /F /T /PID ${child.pid}`, () => {});
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
    this.activeProcesses.delete(id);
  }

  stopAll(): void {
    for (const id of Array.from(this.activeProcesses.keys())) {
      this.stopProcess(id);
    }
  }
}

export const processManager = new ExtensionProcessManager();
