# 🚀 Railway Deployment Guide

This guide will help you deploy your Pemerintah Bot to Railway with optimal configuration.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Railway CLI**: Install with `npm install -g @railway/cli`
3. **Bot Configuration**: Run `bun run setup` and choose "Railway" as deployment target

## Quick Deployment

### 1. Initial Setup

```bash
# Run the interactive setup
bun run setup

# Choose option 2 (Railway) when prompted for deployment target
# This will configure optimal settings for Railway
```

### 2. Deploy to Railway

```bash
# Login to Railway
railway login

# Deploy your bot
railway up

# The deployment will use the optimized railway.toml configuration
```

### 3. Configure Environment Variables

In your Railway dashboard, set these environment variables:

**Required:**

- `DISCORD_WEBHOOK_URL`: Your Discord webhook URL
- `NODE_ENV`: `production`

**Optional (with defaults):**

- `KEYWORDS`: Comma-separated keywords to monitor
- `CHECK_INTERVAL_MINUTES`: How often to check for news (default: 20)
- `MAX_ARTICLES_PER_CHECK`: Maximum articles per cycle (default: 10)
- `LOG_LEVEL`: Logging level (default: info)

## Railway Configuration Details

### Resource Allocation

```toml
[deploy.resources]
memory = "1Gi"    # Increased for stability
cpu = "1"         # Full CPU core for better performance
```

### Health Checks

- **Path**: `/` (main status endpoint)
- **Timeout**: 300 seconds
- **Interval**: 30 seconds

### Optimizations

- **SQLite**: Configured for Railway's ephemeral filesystem
- **Memory**: Optimized Node.js heap size
- **Restart Policy**: Automatic restart on failure (max 10 retries)

## Monitoring Your Deployment

### Health Check Endpoints

1. **Main Status**: `https://your-app.railway.app/`

   ```json
   {
     "status": "healthy",
     "message": "Pemerintah Bot is running",
     "running": true,
     "uptime": 1234.56,
     "nextCheck": "2025-05-25T12:40:00.000Z",
     "config": { ... }
   }
   ```

2. **Detailed Health**: `https://your-app.railway.app/health`

   ```json
   {
     "status": "healthy",
     "database": { "connected": true, "totalArticles": 42 },
     "scheduler": { "jobs": [...] },
     "memory": { "used": 128, "total": 256 },
     "environment": { ... }
   }
   ```

3. **Debug Info**: `https://your-app.railway.app/debug`
   ```json
   {
     "recentArticles": [...],
     "config": { "sources": [...], "keywords": [...] },
     "lastRun": "2025-05-25T12:20:00.000Z"
   }
   ```

### Railway Dashboard Monitoring

1. **Logs**: `railway logs` or check Railway dashboard
2. **Metrics**: Monitor CPU, memory, and network usage
3. **Deployments**: Track deployment history and rollbacks

## Troubleshooting

### Common Issues

1. **Bot Stops Working After Some Time**

   - Check Railway logs for errors
   - Verify environment variables are set
   - Check health endpoints for status

2. **Database Errors**

   - The bot automatically handles SQLite issues
   - Database recreates itself if corrupted
   - Check logs for "Database corruption detected" messages

3. **Memory Issues**

   - Monitor memory usage via `/health` endpoint
   - Current allocation: 1Gi (should be sufficient)
   - Check for memory leaks in logs

4. **Rate Limiting**
   - Default interval: 20 minutes (Railway-optimized)
   - Avoid intervals < 10 minutes on Railway
   - Monitor scraper errors in logs

### Debugging Commands

```bash
# View recent logs
railway logs

# Check deployment status
railway status

# Connect to Railway shell (if needed)
railway shell

# Redeploy
railway up --detach
```

### Log Analysis

Look for these key log messages:

**Successful Startup:**

```
[INFO] Pemerintah Bot started successfully
[INFO] Health check server started on port 3000
[INFO] Discord connection successful
```

**Monitoring Cycle:**

```
[INFO] Starting news monitoring cycle...
[INFO] Scraped X articles from [Source]
[INFO] Found X new matching articles
[INFO] Successfully processed X/X articles
```

**Health Indicators:**

```
[INFO] Bot status report
[DEBUG] Keep-alive ping successful
[INFO] Database cleanup completed
```

## Performance Optimization

### Railway-Specific Settings

The bot is pre-configured with Railway optimizations:

1. **SQLite Configuration**:

   - WAL mode for better concurrency
   - Optimized cache settings
   - Temporary files in `/tmp`

2. **Memory Management**:

   - Node.js heap size: 768MB
   - Automatic garbage collection
   - Memory usage monitoring

3. **Error Recovery**:
   - Database corruption recovery
   - Automatic restart on failures
   - Graceful error handling

### Monitoring Best Practices

1. **Set up alerts** for your Discord channel
2. **Monitor health endpoints** regularly
3. **Check Railway metrics** for resource usage
4. **Review logs** for any error patterns

## Scaling Considerations

### Current Configuration

- **Single instance**: Suitable for most use cases
- **20-minute intervals**: Balances freshness with resource usage
- **10 articles per check**: Prevents Discord rate limiting

### If You Need More Frequent Updates

1. Reduce `CHECK_INTERVAL_MINUTES` (minimum: 10 for Railway)
2. Monitor resource usage closely
3. Consider upgrading Railway plan if needed

## Security Notes

1. **Environment Variables**: Never commit webhook URLs to git
2. **Health Endpoints**: No sensitive data exposed
3. **Database**: Local SQLite, no external connections
4. **Rate Limiting**: Built-in protection against abuse

## Support

If you encounter issues:

1. Check this guide first
2. Review Railway logs: `railway logs`
3. Test health endpoints
4. Check Discord webhook configuration
5. Verify environment variables in Railway dashboard

---

**Happy monitoring! 🇮🇩**
