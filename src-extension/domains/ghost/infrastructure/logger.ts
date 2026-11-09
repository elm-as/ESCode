import * as vscode from 'vscode';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Singleton logger writing to a VS Code Output Channel named "FakeCoder".
 * Centralised here because every domain module needs structured logging
 * without coupling to vscode.window directly.
 */
export class Logger {
  private static instance: Logger | undefined;
  private readonly channel: vscode.OutputChannel;
  private level: LogLevel = LogLevel.INFO;

  private constructor() {
    this.channel = vscode.window.createOutputChannel('FakeCoder');
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    const map: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
    };
    this.level = map[level] ?? LogLevel.INFO;
  }

  debug(message: string): void {
    if (this.level <= LogLevel.DEBUG) {
      this.write('DEBUG', message);
    }
  }

  info(message: string): void {
    if (this.level <= LogLevel.INFO) {
      this.write('INFO', message);
    }
  }

  warn(message: string): void {
    if (this.level <= LogLevel.WARN) {
      this.write('WARN', message);
    }
  }

  error(message: string, err?: unknown): void {
    if (this.level <= LogLevel.ERROR) {
      const detail = err instanceof Error ? `: ${err.message}` : '';
      this.write('ERROR', `${message}${detail}`);
    }
  }

  show(): void {
    this.channel.show(true);
  }

  dispose(): void {
    this.channel.dispose();
    Logger.instance = undefined;
  }

  private write(level: string, message: string): void {
    const timestamp = new Date().toISOString().slice(11, 23);
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }
}
