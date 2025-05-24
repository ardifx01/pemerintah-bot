import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private logLevel: LogLevel;
  private logFile?: string;

  constructor(level: LogLevel = "info", logFile?: string) {
    this.logLevel = level;
    this.logFile = logFile;

    if (this.logFile) {
      const logDir = dirname(this.logFile);
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
    }
  }

  private getLevelNumber(level: LogLevel): number {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return this.getLevelNumber(level) >= this.getLevelNumber(this.logLevel);
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, data } = entry;
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${dataStr}`;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    const formattedMessage = this.formatLogEntry(entry);

    // Console output with colors
    const colors = {
      debug: "\x1b[36m", // cyan
      info: "\x1b[32m", // green
      warn: "\x1b[33m", // yellow
      error: "\x1b[31m", // red
    };
    const reset = "\x1b[0m";

    console.log(`${colors[level]}${formattedMessage}${reset}`);

    // File output
    if (this.logFile) {
      try {
        appendFileSync(this.logFile, formattedMessage + "\n");
      } catch (error) {
        console.error("Failed to write to log file:", error);
      }
    }
  }

  debug(message: string, data?: any): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: any): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: any): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: any): void {
    this.log("error", message, data);
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

// Export a default logger instance
export const logger = new Logger();

// Export the Logger class for custom instances
export { Logger };
