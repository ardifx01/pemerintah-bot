import { readFileSync } from "fs";
import { join } from "path";

export interface AppConfig {
  discord: {
    webhookUrl: string;
  };
  keywords: string[];
  monitoring: {
    checkIntervalMinutes: number;
    maxArticlesPerCheck: number;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
  };
  database: {
    path: string;
  };
  rateLimit: {
    requestsPerMinute: number;
  };
  userAgent: string;
}

function loadEnvFile(): Record<string, string> {
  const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env";
  try {
    const envContent = readFileSync(envFile, "utf-8");
    const env: Record<string, string> = {};

    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          env[key] = valueParts.join("=");
        }
      }
    });

    return env;
  } catch (error) {
    console.warn("Could not load .env file, using environment variables only");
    return {};
  }
}

function getEnvValue(key: string, defaultValue?: string): string {
  const envFromFile = loadEnvFile();
  const value = process.env[key] || envFromFile[key] || defaultValue;

  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }

  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = getEnvValue(key, defaultValue.toString());
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }

  return parsed;
}

function validateDiscordWebhook(url: string): void {
  const webhookPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
  if (!webhookPattern.test(url)) {
    throw new Error("Invalid Discord webhook URL format");
  }
}

export function loadConfig(): AppConfig {
  const discordWebhookUrl = getEnvValue("DISCORD_WEBHOOK_URL");
  validateDiscordWebhook(discordWebhookUrl);

  const keywordsString = getEnvValue("KEYWORDS", "pemerintah,prabowo");
  const keywords = keywordsString
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);

  if (keywords.length === 0) {
    throw new Error("At least one keyword must be specified");
  }

  const logLevel = getEnvValue(
    "LOG_LEVEL",
    "info"
  ) as AppConfig["logging"]["level"];
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error("LOG_LEVEL must be one of: debug, info, warn, error");
  }

  return {
    discord: {
      webhookUrl: discordWebhookUrl,
    },
    keywords,
    monitoring: {
      checkIntervalMinutes: getEnvNumber("CHECK_INTERVAL_MINUTES", 5),
      maxArticlesPerCheck: getEnvNumber("MAX_ARTICLES_PER_CHECK", 10),
    },
    logging: {
      level: logLevel,
    },
    database: {
      path: getEnvValue("DATABASE_PATH", "./data/news.db"),
    },
    rateLimit: {
      requestsPerMinute: getEnvNumber("RATE_LIMIT_RPM", 30),
    },
    userAgent: getEnvValue(
      "USER_AGENT",
      "Mozilla/5.0 (compatible; PemerintahBot/1.0)"
    ),
  };
}
