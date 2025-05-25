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
  deploymentTarget: string;
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
    checkIntervalMinutes: 20,
    maxArticlesPerCheck: 10,
    logLevel: "info",
    deploymentTarget: "local",
  };

  // Deployment target selection
  console.log("🚀 Deployment Configuration");
  console.log("---------------------------");
  console.log("Where will you deploy this bot?");
  console.log("1. Local development");
  console.log("2. Railway (recommended for production)");
  console.log("3. Other cloud platform");
  console.log();

  while (true) {
    const deployChoice = await prompt(
      "Choose deployment target (1-3, default: 1): "
    );
    const choice = deployChoice || "1";

    if (choice === "1") {
      config.deploymentTarget = "local";
      config.checkIntervalMinutes = 5; // Shorter interval for local dev
      break;
    } else if (choice === "2") {
      config.deploymentTarget = "railway";
      config.checkIntervalMinutes = 20; // Longer interval for production
      break;
    } else if (choice === "3") {
      config.deploymentTarget = "cloud";
      config.checkIntervalMinutes = 15; // Medium interval for other clouds
      break;
    } else {
      console.log("❌ Please choose 1, 2, or 3.\n");
    }
  }

  console.log(`✅ Deployment target: ${config.deploymentTarget}\n`);

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
  console.log(
    "Default keywords include: pemerintah, prabowo, mbg, jokowi, anies"
  );
  console.log();

  while (true) {
    const keywordsInput = await prompt(
      "Enter keywords (or press Enter for defaults): "
    );
    const keywords = keywordsInput
      ? parseKeywords(keywordsInput)
      : [
          "pemerintah",
          "prabowo",
          "mbg",
          "jokowi",
          "anies",
          "makan bergizi gratis",
          "ikn",
          "ijazah",
          "ruu tni",
          "ruu polri",
          "ijazah palsu",
          "ijazah asli",
          "bareskrim",
        ];

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
  console.log(
    `Recommended interval for ${config.deploymentTarget}: ${config.checkIntervalMinutes} minutes`
  );

  while (true) {
    const intervalInput = await prompt(
      `Check for news every X minutes (default: ${config.checkIntervalMinutes}): `
    );
    const interval = intervalInput
      ? parseInt(intervalInput, 10)
      : config.checkIntervalMinutes;

    if (isNaN(interval) || interval < 1) {
      console.log("❌ Please enter a valid number (minimum 1 minute).\n");
      continue;
    }

    if (config.deploymentTarget === "railway" && interval < 10) {
      console.log(
        "⚠️  For Railway deployment, intervals less than 10 minutes may cause rate limiting."
      );
      const proceed = await prompt("Continue with this interval? (y/N): ");
      if (proceed.toLowerCase() !== "y" && proceed.toLowerCase() !== "yes") {
        continue;
      }
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
  console.log(
    `Recommended for ${config.deploymentTarget}: ${config.deploymentTarget === "local" ? "debug" : "info"}`
  );

  while (true) {
    const defaultLogLevel =
      config.deploymentTarget === "local" ? "debug" : "info";
    const logLevel = await prompt(`Log level (default: ${defaultLogLevel}): `);
    const level = logLevel || defaultLogLevel;

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

  // Generate environment-specific configuration
  let envContent = `# Discord Configuration
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

  // Add deployment-specific configurations
  if (config.deploymentTarget === "railway") {
    envContent += `
# Railway-specific optimizations
NODE_ENV=production
SQLITE_TMPDIR=/tmp
NODE_OPTIONS=--max-old-space-size=768
`;
  } else if (config.deploymentTarget === "local") {
    envContent += `
# Local development settings
NODE_ENV=development
`;
  }

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
  console.log(`• Deployment target: ${config.deploymentTarget}`);
  console.log(
    `• Discord webhook: ${config.discordWebhookUrl.substring(0, 50)}...`
  );
  console.log(`• Keywords: ${config.keywords.join(", ")}`);
  console.log(`• Check interval: ${config.checkIntervalMinutes} minutes`);
  console.log(`• Max articles per check: ${config.maxArticlesPerCheck}`);
  console.log(`• Log level: ${config.logLevel}`);
  console.log();

  // Deployment-specific instructions
  if (config.deploymentTarget === "railway") {
    console.log("🚀 Railway Deployment Instructions:");
    console.log("===================================");
    console.log("1. Install Railway CLI: npm install -g @railway/cli");
    console.log("2. Login to Railway: railway login");
    console.log("3. Deploy: railway up");
    console.log("4. Set environment variables in Railway dashboard:");
    console.log(`   DISCORD_WEBHOOK_URL=${config.discordWebhookUrl}`);
    console.log("5. Monitor deployment: railway logs");
    console.log();
    console.log("Health check endpoints:");
    console.log("• Status: https://your-app.railway.app/");
    console.log("• Health: https://your-app.railway.app/health");
    console.log("• Debug: https://your-app.railway.app/debug");
    console.log();
  }

  console.log("To start the bot locally:");
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
