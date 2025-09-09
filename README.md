# Pemerintah Bot - Indonesian News Monitor

A bot that monitors Indonesian news sites and sends filtered articles to your Discord channels based on customizable keywords.

## Features

- **Multi-source monitoring**: CNN Indonesia, Detik.com, Kompas.com, BBC Indonesia
- **Smart keyword filtering**: Supports both single words and multi-word phrases with whole-word matching
- **Rich Discord integration**: Beautiful embeds with article images, descriptions, and highlighted keywords
- **Visual content**: Automatically fetches and displays article images from OpenGraph meta tags
- **Article previews**: Extracts first 1-2 sentences for better content insight
- **Real-time monitoring**: Only new articles (no historical spam)
- **Fast & efficient**: Built with Bun.js for optimal performance
- **Robust**: Handles rate limiting and errors gracefully with automatic recovery
- **Smart deduplication**: SQLite database prevents duplicate notifications
- **Production-ready**: Optimized for Railway deployment with health checks and monitoring

## Prerequisites

- [Bun.js](https://bun.sh/) installed on your system
- Discord webhook URL
- Node.js 18+ (for SQLite compatibility)

## Quick Start

### 🚀 Automated Setup (Recommended)

1. **Clone and install dependencies**:

   ```bash
   git clone https://github.com/ardifx01/pemerintah-bot
   cd pemerintah-bot
   bun install
   ```

2. **Run the interactive setup**:

   ```bash
   bun run setup
   ```

   The setup wizard will:

   - Guide you through deployment target selection (Local/Railway/Cloud)
   - Configure Discord webhook
   - Set up keywords with smart defaults
   - Optimize settings for your deployment environment
   - Generate deployment-specific configurations

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

**Required:**

- `DISCORD_WEBHOOK_URL`: Your Discord webhook URL

**Optional (with smart defaults):**

- `KEYWORDS`: Comma-separated keywords (default: comprehensive Indonesian political keywords)
- `CHECK_INTERVAL_MINUTES`: Monitoring frequency (default: 5 local, 20 Railway)
- `MAX_ARTICLES_PER_CHECK`: Articles per cycle (default: 10)
- `LOG_LEVEL`: Logging level (default: debug local, info production)
- `DATABASE_PATH`: SQLite database location (default: ./data/news.db)

### Supported News Sources

- **CNN Indonesia**: RSS feed + metadata extraction
- **Detik.com**: RSS feed + metadata extraction
- **BBC Indonesia**: RSS feed + metadata extraction
- **Kompas.com**: RSS feed + metadata extraction

## How It Works

1. **RSS Monitoring**: Efficiently fetches latest articles via RSS feeds
2. **Smart Filtering**: Matches articles against your keywords using intelligent whole-word matching
3. **Metadata Enhancement**: Extracts OpenGraph images and article descriptions
4. **Duplicate Prevention**: SQLite database tracks processed articles
5. **Rich Notifications**: Sends beautifully formatted Discord embeds
6. **Error Recovery**: Automatic database recovery and graceful error handling

## Deployment

### 🚀 Railway (Recommended for Production)

Railway deployment is fully optimized with:

- **Enhanced resource allocation**: 1Gi memory, 1 CPU core
- **Automatic health checks**: Built-in monitoring endpoints
- **Database optimizations**: SQLite configured for Railway's filesystem
- **Error recovery**: Automatic restart on failures
- **Performance tuning**: Memory and CPU optimizations

**Quick Deploy:**

1. **Run setup with Railway target**:

   ```bash
   bun run setup
   # Choose option 2 (Railway) for optimal configuration
   ```

2. **Deploy to Railway**:

   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login and deploy
   railway login
   railway up
   ```

3. **Set environment variables** in Railway dashboard:
   - `DISCORD_WEBHOOK_URL`: Your Discord webhook URL
   - Other variables are automatically configured by setup

**For detailed Railway deployment instructions, see [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)**

### Monitoring & Health Checks

Your deployed bot includes comprehensive monitoring:

- **Status Endpoint**: `https://your-app.railway.app/` - Basic health status
- **Health Endpoint**: `https://your-app.railway.app/health` - Detailed system info
- **Debug Endpoint**: `https://your-app.railway.app/debug` - Recent articles and config

### Other Platforms

The bot works on any Node.js/Bun-compatible platform:

- **Render**: Set build command to `bun install` and start command to `bun start`
- **Heroku**: Add `bun` buildpack
- **DigitalOcean App Platform**: Use Node.js environment
- **VPS**: Clone repo, run `bun install && bun start`

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
│   │   ├── kompas.ts        # Kompas.com scraper
│   │   └── bbc-indonesia.ts # BBC Indonesia scraper
│   ├── services/
│   │   ├── database.ts      # SQLite database service
│   │   ├── discord.ts       # Discord webhook service
│   │   └── scheduler.ts     # Cron job scheduler
│   └── utils/
│       ├── logger.ts        # Logging utilities
│       └── keywords.ts      # Keyword matching utilities
├── setup.ts                 # Interactive setup wizard
├── railway.toml             # Railway deployment config
├── railway-start.sh         # Railway startup script
├── RAILWAY_DEPLOYMENT.md    # Detailed Railway guide
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

# Run setup wizard
bun run setup
```

## Troubleshooting

### Common Issues

1. **Bot stops working on Railway**: Check health endpoints and Railway logs
2. **Database errors**: The bot automatically recovers from SQLite corruption
3. **No articles found**: Verify keywords and check debug endpoint
4. **Discord not receiving messages**: Verify webhook URL and test connection

### Debug Commands

```bash
# Check bot status (when running)
curl https://your-app.railway.app/health

# View recent articles and config
curl https://your-app.railway.app/debug

# Railway logs
railway logs
```

## Security & Performance

- **Rate limiting**: Respects source websites with intelligent delays
- **Error recovery**: Automatic database corruption recovery
- **Resource optimization**: Memory and CPU usage optimized for Railway
- **Secure configuration**: Environment variables for sensitive data
- **Health monitoring**: Built-in endpoints for deployment monitoring

## License

MIT License - see LICENSE file for details
