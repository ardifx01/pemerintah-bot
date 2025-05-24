import { loadConfig } from './config/settings.js';
import { Logger } from './utils/logger.js';
import { validateKeywords, findMatchingKeywords } from './utils/keywords.js';
import { DatabaseService } from './services/database.js';
import { DiscordService } from './services/discord.js';
import { SchedulerService } from './services/scheduler.js';
import { CNNIndonesiaScraper } from './scrapers/cnn-indonesia.js';
import { DetikScraper } from './scrapers/detik.js';
import { BBCIndonesiaScraper } from './scrapers/bbc-indonesia.js';
import type { BaseScraper } from './scrapers/base.js';
import type { Article } from './services/database.js';

class PemerintahBot {
  private config = loadConfig();
  private logger: Logger;
  private database: DatabaseService;
  private discord: DiscordService;
  private scheduler: SchedulerService;
  private scrapers: BaseScraper[];
  private isRunning = false;

  constructor() {
    // Initialize logger
    this.logger = new Logger(this.config.logging.level, './logs/app.log');
    
    // Initialize services
    this.database = new DatabaseService(this.config.database.path);
    this.discord = new DiscordService(this.config.discord.webhookUrl);
    this.scheduler = new SchedulerService();

    // Initialize scrapers
    this.scrapers = [
      new CNNIndonesiaScraper(this.config.userAgent),
      new DetikScraper(this.config.userAgent),
      new BBCIndonesiaScraper(this.config.userAgent),
    ];

    // Validate configuration
    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    this.logger.info('Validating configuration...');

    // Validate keywords
    const keywordErrors = validateKeywords(this.config.keywords);
    if (keywordErrors.length > 0) {
      this.logger.error('Invalid keywords detected', { errors: keywordErrors });
      throw new Error(`Invalid keywords: ${keywordErrors.join(', ')}`);
    }

    this.logger.info('Configuration validated successfully', {
      keywords: this.config.keywords,
      sources: this.scrapers.map(s => s.getSource()),
      checkInterval: this.config.monitoring.checkIntervalMinutes,
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Bot is already running');
      return;
    }

    try {
      this.logger.info('Starting Pemerintah Bot...');

      // Initialize database
      await this.database.initialize();

      // Test Discord connection
      this.logger.info('Testing Discord connection...');
      const discordConnected = await this.discord.testConnection();
      if (!discordConnected) {
        throw new Error('Failed to connect to Discord webhook');
      }
      this.logger.info('Discord connection successful');

      // Schedule periodic news monitoring
      this.scheduler.scheduleJob(
        'news-monitor',
        this.config.monitoring.checkIntervalMinutes,
        () => this.monitorNews(),
        false // Don't start immediately, we'll do an initial run first
      );

      // Do an initial run
      this.logger.info('Performing initial news check...');
      await this.monitorNews();

      this.isRunning = true;
      this.logger.info('Pemerintah Bot started successfully', {
        nextCheck: this.scheduler.getNextRunTime('news-monitor'),
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Log status periodically
      this.scheduleStatusLogging();

    } catch (error) {
      this.logger.error('Failed to start bot', { error });
      await this.shutdown();
      throw error;
    }
  }

  private async monitorNews(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('Starting news monitoring cycle...');

    try {
      const allArticles: Article[] = [];
      const errors: string[] = [];

      // Scrape from all sources
      for (const scraper of this.scrapers) {
        try {
          this.logger.debug(`Scraping from ${scraper.getSource()}...`);
          const result = await scraper.scrapeNews();

          if (result.success && result.articles.length > 0) {
            this.logger.info(`Scraped ${result.articles.length} articles from ${scraper.getSource()}`);
            
            // Filter for matching keywords and new articles
            for (const article of result.articles) {
              const matchedKeywords = findMatchingKeywords(article.title, this.config.keywords);
              
              if (matchedKeywords.length > 0) {
                // Check if we've already processed this article
                const alreadyProcessed = await this.database.isArticleProcessed(article.url);
                
                if (!alreadyProcessed) {
                  const processedArticle: Article = {
                    ...article,
                    matchedKeywords,
                    processedAt: new Date(),
                  };
                  
                  allArticles.push(processedArticle);
                  this.logger.info(`Found matching article from ${article.source}`, {
                    title: article.title,
                    keywords: matchedKeywords,
                  });
                } else {
                  this.logger.debug(`Skipping already processed article: ${article.title}`);
                }
              }
            }
          } else {
            this.logger.warn(`No articles scraped from ${scraper.getSource()}`, {
              errors: result.errors,
            });
            errors.push(...result.errors);
          }

          // Add delay between scrapers to be respectful
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error: any) {
          const errorMsg = `Error scraping ${scraper.getSource()}: ${error.message}`;
          this.logger.error(errorMsg, { error });
          errors.push(errorMsg);
        }
      }

      // Process and send new articles
      if (allArticles.length > 0) {
        this.logger.info(`Found ${allArticles.length} new matching articles`);
        
        // Limit the number of articles to process in one cycle
        const articlesToProcess = allArticles.slice(0, this.config.monitoring.maxArticlesPerCheck);
        
        if (articlesToProcess.length < allArticles.length) {
          this.logger.info(`Limiting to ${articlesToProcess.length} articles per cycle`);
        }

        // Send to Discord and save to database
        const sentCount = await this.discord.sendBulkArticles(articlesToProcess);
        
        for (const article of articlesToProcess) {
          try {
            await this.database.saveArticle(article);
          } catch (error) {
            this.logger.error('Failed to save article to database', { 
              error, 
              article: article.title 
            });
          }
        }

        this.logger.info(`Successfully processed ${sentCount}/${articlesToProcess.length} articles`);
      } else {
        this.logger.info('No new matching articles found');
      }

      const duration = Date.now() - startTime;
      this.logger.info('News monitoring cycle completed', {
        durationMs: duration,
        articlesFound: allArticles.length,
        errors: errors.length,
      });

    } catch (error) {
      this.logger.error('Error during news monitoring cycle', { error });
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  private scheduleStatusLogging(): void {
    // Log status every hour
    this.scheduler.scheduleJob(
      'status-logger',
      60, // 60 minutes
      async () => {
        const stats = await this.database.getStats();
        const jobsStatus = this.scheduler.getJobsStatus();
        
        this.logger.info('Bot status report', {
          totalArticlesProcessed: stats.total,
          articlesBySource: stats.bySource,
          scheduledJobs: jobsStatus,
          uptime: process.uptime(),
        });
      }
    );

    // Cleanup old articles daily
    this.scheduler.scheduleJob(
      'database-cleanup',
      '0 2 * * *', // 2 AM daily
      async () => {
        this.logger.info('Starting database cleanup...');
        const deletedCount = await this.database.cleanup(30); // Keep 30 days
        this.logger.info(`Database cleanup completed, deleted ${deletedCount} old articles`);
      }
    );
  }

  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Shutting down Pemerintah Bot...');

    try {
      // Stop all scheduled jobs
      this.scheduler.stopAllJobs();
      
      // Close database connection
      await this.database.close();
      
      this.isRunning = false;
      this.logger.info('Bot shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
    }
  }

  getStatus(): {
    running: boolean;
    uptime: number;
    nextCheck: Date | null;
    config: typeof this.config;
  } {
    return {
      running: this.isRunning,
      uptime: process.uptime(),
      nextCheck: this.scheduler.getNextRunTime('news-monitor'),
      config: this.config,
    };
  }
}

// Main execution
async function main() {
  const bot = new PemerintahBot();
  
  try {
    await bot.start();
    
    // Keep the process running
    process.stdin.resume();
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.main) {
  main();
}

export { PemerintahBot }; 