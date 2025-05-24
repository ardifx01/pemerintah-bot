#!/usr/bin/env bun
/**
 * Setup script for Pemerintah Bot
 * This script helps users configure the bot interactively
 */

import { writeFileSync, existsSync } from "fs";

interface SetupConfig {
  discordWebhookUrl: string;
  keywords: string[];
  checkIntervalMinutes: number;
  maxArticlesPerCheck: number;
  logLevel: string;
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.once("data", (data) => {
      resolve(data.toString().trim());
    });
  });
}

function validateWebhookUrl(url: string): boolean {
  const webhookPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
  return webhookPattern.test(url);
}

function parseKeywords(input: string): string[] {
  return input
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
}

async function setup(): Promise<void> {
  console.log("🤖 Pemerintah Bot Setup");
  console.log("=====================\n");

  console.log(
    "This setup will help you configure the Indonesian news monitoring bot.\n"
  );

  if (existsSync(".env")) {
    console.log("⚠️  .env file already exists!");
    const overwrite = await prompt("Do you want to overwrite it? (y/N): ");
    if (overwrite.toLowerCase() !== "y" && overwrite.toLowerCase() !== "yes") {
      console.log("Setup cancelled.");
      process.exit(0);
    }
    console.log();
  }

  const config: SetupConfig = {
    discordWebhookUrl: "",
    keywords: [],
    checkIntervalMinutes: 5,
    maxArticlesPerCheck: 10,
    logLevel: "info",
  };

  console.log("📢 Discord Configuration");
  console.log("------------------------");
  console.log("To get a Discord webhook URL:");
  console.log("1. Go to your Discord server settings");
  console.log("2. Navigate to Integrations > Webhooks");
  console.log("3. Create a new webhook");
  console.log("4. Copy the webhook URL");
  console.log();

  while (true) {
    const webhookUrl = await prompt("Enter your Discord webhook URL: ");
    if (validateWebhookUrl(webhookUrl)) {
      config.discordWebhookUrl = webhookUrl;
      break;
    } else {
      console.log("❌ Invalid webhook URL format. Please try again.\n");
    }
  }

  console.log("✅ Discord webhook URL configured\n");

  // Keywords
  console.log("🔍 Keywords Configuration");
  console.log("-------------------------");
  console.log("Enter keywords to monitor (comma-separated).");
  console.log("Examples: pemerintah, prabowo, jokowi, anies, MBG");
  console.log();

  while (true) {
    const keywordsInput = await prompt("Enter keywords: ");
    const keywords = parseKeywords(keywordsInput);

    if (keywords.length === 0) {
      console.log("❌ Please enter at least one keyword.\n");
      continue;
    }

    console.log(`Keywords: ${keywords.join(", ")}`);
    const confirm = await prompt("Are these keywords correct? (Y/n): ");

    if (confirm.toLowerCase() !== "n" && confirm.toLowerCase() !== "no") {
      config.keywords = keywords;
      break;
    }
    console.log();
  }

  console.log("✅ Keywords configured\n");

  console.log("⏰ Monitoring Configuration");
  console.log("---------------------------");

  while (true) {
    const intervalInput = await prompt(
      "Check for news every X minutes (default: 5): "
    );
    const interval = intervalInput ? parseInt(intervalInput, 10) : 5;

    if (isNaN(interval) || interval < 1) {
      console.log("❌ Please enter a valid number (minimum 1 minute).\n");
      continue;
    }

    config.checkIntervalMinutes = interval;
    break;
  }

  while (true) {
    const maxArticlesInput = await prompt(
      "Maximum articles per check (default: 10): "
    );
    const maxArticles = maxArticlesInput ? parseInt(maxArticlesInput, 10) : 10;

    if (isNaN(maxArticles) || maxArticles < 1) {
      console.log("❌ Please enter a valid number (minimum 1).\n");
      continue;
    }

    config.maxArticlesPerCheck = maxArticles;
    break;
  }

  console.log("✅ Monitoring configuration set\n");

  console.log("📝 Logging Configuration");
  console.log("------------------------");
  console.log("Available log levels: debug, info, warn, error");

  while (true) {
    const logLevel = await prompt("Log level (default: info): ");
    const level = logLevel || "info";

    if (!["debug", "info", "warn", "error"].includes(level)) {
      console.log(
        "❌ Invalid log level. Choose from: debug, info, warn, error\n"
      );
      continue;
    }

    config.logLevel = level;
    break;
  }

  console.log("✅ Log level configured\n");

  const envContent = `# Discord Configuration
DISCORD_WEBHOOK_URL=${config.discordWebhookUrl}

# Keywords to monitor (comma-separated, case-insensitive)
KEYWORDS=${config.keywords.join(",")}

# Monitoring Configuration
CHECK_INTERVAL_MINUTES=${config.checkIntervalMinutes}
MAX_ARTICLES_PER_CHECK=${config.maxArticlesPerCheck}

# Logging Configuration
LOG_LEVEL=${config.logLevel}

# Database Configuration
DATABASE_PATH=./data/news.db

# Rate Limiting (requests per minute)
RATE_LIMIT_RPM=30

# User Agent for web requests
USER_AGENT=Mozilla/5.0 (compatible; PemerintahBot/1.0; +https://github.com/yourname/pemerintah-bot)
`;

  try {
    writeFileSync(".env", envContent);
    console.log("✅ Configuration saved to .env file\n");
  } catch (error) {
    console.error("❌ Failed to save configuration:", error);
    process.exit(1);
  }

  console.log("🎉 Setup Complete!");
  console.log("==================");
  console.log("Configuration Summary:");
  console.log(
    `• Discord webhook: ${config.discordWebhookUrl.substring(0, 50)}...`
  );
  console.log(`• Keywords: ${config.keywords.join(", ")}`);
  console.log(`• Check interval: ${config.checkIntervalMinutes} minutes`);
  console.log(`• Max articles per check: ${config.maxArticlesPerCheck}`);
  console.log(`• Log level: ${config.logLevel}`);
  console.log();
  console.log("To start the bot, run:");
  console.log("  bun start");
  console.log();
  console.log("To run in development mode (with auto-reload):");
  console.log("  bun run dev");
  console.log();
  console.log("Happy monitoring! 🇮🇩");
}

if ((import.meta as any).main) {
  process.stdin.setRawMode(false);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  setup()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Setup failed:", error);
      process.exit(1);
    });
}
