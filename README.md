# Pemerintah Bot - Indonesian News Monitor

A TypeScript-based bot that monitors Indonesian news sites and sends filtered articles to Discord channels based on customizable keywords.

## Features

- 🔍 **Multi-source monitoring**: CNN Indonesia, Detik.com, BBC Indonesia
- 🎯 **Keyword filtering**: Customizable whole-word matching
- 📢 **Discord integration**: Automatic posting to Discord channels
- 🚀 **Real-time monitoring**: Only new articles (no historical spam)
- ⚡ **Fast & efficient**: Built with Bun.js for optimal performance
- 🛡️ **Robust**: Handles rate limiting and errors gracefully

## Prerequisites

- [Bun.js](https://bun.sh/) installed on your system
- Discord webhook URL or bot token
- Node.js 18+ (for SQLite compatibility)

## Quick Start

1. **Clone and install dependencies**:

   ```bash
   bun install
   ```

2. **Run the setup script**:

   ```bash
   bun run setup
   ```

   This interactive setup will guide you through configuring your Discord webhook, keywords, and monitoring settings.

3. **Start the bot**:

   ```bash
   # Development mode (with auto-reload)
   bun run dev

   # Production mode
   bun start
   ```

### Manual Configuration (Alternative)

If you prefer to configure manually:

1. **Copy the example environment file**:

   ```bash
   cp env.example .env
   ```

2. **Edit `.env` with your settings**:
   - Set your Discord webhook URL
   - Configure your keywords
   - Adjust monitoring settings

## Configuration

### Environment Variables

- `DISCORD_WEBHOOK_URL`: Your Discord webhook URL
- `KEYWORDS`: Comma-separated list of keywords (e.g., "pemerintah,prabowo,MBG")
- `CHECK_INTERVAL_MINUTES`: How often to check for news (default: 5)
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

### Supported News Sources

- **CNN Indonesia**: RSS feed + web scraping fallback
- **Detik.com**: RSS feed + web scraping fallback
- **BBC Indonesia**: RSS feed + web scraping fallback

## How It Works

1. **RSS First**: Attempts to fetch news via RSS feeds for efficiency
2. **Web Scraping Fallback**: If RSS fails, falls back to web scraping
3. **Duplicate Detection**: Uses SQLite to track already-sent articles
4. **Keyword Matching**: Filters titles using whole-word matching
5. **Discord Notification**: Sends formatted messages to your Discord channel

## Project Structure

```
├── src/
│   ├── index.ts              # Main application entry
│   ├── config/
│   │   └── settings.ts       # Configuration management
│   ├── scrapers/
│   │   ├── base.ts          # Base scraper interface
│   │   ├── cnn-indonesia.ts # CNN Indonesia scraper
│   │   ├── detik.ts         # Detik.com scraper
│   │   └── bbc-indonesia.ts # BBC Indonesia scraper
│   ├── services/
│   │   ├── database.ts      # SQLite database service
│   │   ├── discord.ts       # Discord webhook service
│   │   └── scheduler.ts     # Cron job scheduler
│   └── utils/
│       ├── logger.ts        # Logging utilities
│       └── keywords.ts      # Keyword matching utilities
├── data/
│   └── news.db             # SQLite database (auto-created)
└── logs/
    └── app.log             # Application logs
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Format code
bun run format

# Lint code
bun run lint

# Build for production
bun run build
```

## Security & Rate Limiting

- Respects robots.txt where applicable
- Implements exponential backoff for failed requests
- Rate limiting to avoid overwhelming news sources
- Secure storage of sensitive configuration

## Deployment

### Railway (Recommended)

1. **One-click deploy**: [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-url)

2. **Manual deployment**:

   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login and deploy
   railway login
   railway init
   railway up
   ```

3. **Set environment variables** in Railway dashboard:
   - `DISCORD_WEBHOOK_URL`: Your Discord webhook URL
   - `KEYWORDS`: Comma-separated keywords to monitor
   - `CHECK_INTERVAL_MINUTES`: How often to check (default: 5)
   - `DATABASE_PATH`: `/app/data/news.db` (for Railway)

### Other Platforms

The bot works on any Node.js/Bun-compatible platform:

- **Render**: Set build command to `bun install` and start command to `bun start`
- **Heroku**: Add `bun` buildpack
- **DigitalOcean App Platform**: Use Node.js environment
- **VPS**: Clone repo, run `bun install && bun start`

## License

MIT License - see LICENSE file for details
