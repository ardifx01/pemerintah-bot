import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { BaseScraper, NewsItem, ScrapedResult } from "./base.js";
import { logger } from "../utils/logger.js";

export class BBCIndonesiaScraper extends BaseScraper {
  private rssParser: Parser;
  private readonly RSS_URL = "https://feeds.bbci.co.uk/indonesia/rss.xml";
  private readonly BASE_URL = "https://www.bbc.com/indonesia";

  constructor(userAgent: string) {
    super("BBC Indonesia", userAgent);
    this.rssParser = new Parser({
      timeout: 10000,
      headers: {
        "User-Agent": userAgent,
      },
    });
  }

  async scrapeNews(): Promise<ScrapedResult> {
    const result: ScrapedResult = {
      articles: [],
      success: false,
      errors: [],
    };

    try {
      const rssArticles = await this.scrapeViaRSS();
      if (rssArticles.length > 0) {
        result.articles = rssArticles;
        result.success = true;
        logger.info(
          `Successfully scraped ${rssArticles.length} articles from BBC Indonesia RSS`
        );
      } else {
        logger.info(
          "RSS failed, falling back to HTML scraping for BBC Indonesia"
        );
        const htmlArticles = await this.scrapeViaHTML();
        result.articles = htmlArticles;
        result.success = htmlArticles.length > 0;
        logger.info(
          `Scraped ${htmlArticles.length} articles from BBC Indonesia HTML`
        );
      }

      this.setLastScrapeTime();
    } catch (error: any) {
      const errorMessage = `BBC Indonesia scraping failed: ${error.message}`;
      result.errors.push(errorMessage);
      logger.error(errorMessage, { error });
    }

    return result;
  }

  private async scrapeViaRSS(): Promise<NewsItem[]> {
    try {
      const feed = await this.rssParser.parseURL(this.RSS_URL);
      const articles: NewsItem[] = [];

      if (!feed.items || feed.items.length === 0) {
        logger.warn("No items found in BBC Indonesia RSS feed");
        return articles;
      }

      for (const item of feed.items.slice(0, 20)) {
        try {
          if (!item.title || !item.link) {
            continue;
          }

          const publishedAt = item.pubDate
            ? new Date(item.pubDate)
            : new Date();

          const now = new Date();
          const hoursDiff =
            (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
          if (hoursDiff > 48) {
            continue;
          }

          articles.push({
            title: this.cleanTitle(item.title),
            url: item.link,
            publishedAt,
            source: this.source,
          });
        } catch (error) {
          logger.warn("Error processing RSS item", { error, item: item.title });
        }
      }

      return articles;
    } catch (error: any) {
      logger.error("RSS parsing failed for BBC Indonesia", {
        error: error.message,
      });
      throw error;
    }
  }

  private async scrapeViaHTML(): Promise<NewsItem[]> {
    try {
      const response = await this.httpClient.get(this.BASE_URL);
      const $ = cheerio.load(response.data);
      const articles: NewsItem[] = [];

      const selectors = [
        '[data-testid="topic-promos"] article', // Main topic articles
        '[data-testid="latest-stories"] article', // Latest stories
        ".nw-c-promo", // BBC promo cards
        "article", // Generic articles
        ".media-item", // Media items
      ];

      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length === 0) continue;

        logger.debug(
          `Found ${elements.length} elements with selector: ${selector}`
        );

        elements.each((_, element) => {
          try {
            const $el = $(element);

            let title = "";
            let url = "";

            // Pattern 1: BBC specific structure
            const linkEl = $el.find('a[href*="/indonesia/"]').first();
            if (linkEl.length) {
              url = linkEl.attr("href") || "";

              title = linkEl
                .find("h3, h2, .promo-heading, .media-heading")
                .text()
                .trim();
              if (!title) {
                title = linkEl.attr("aria-label") || linkEl.text().trim();
              }
            }

            // Pattern 2: Title in heading elements
            if (!title) {
              const headingEl = $el.find("h1, h2, h3, h4").first();
              if (headingEl.length) {
                title = headingEl.text().trim();
                url = $el.find("a").first().attr("href") || "";
              }
            }

            // Pattern 3: Direct link element
            if (!title && $el.is('a[href*="/indonesia/"]')) {
              title = $el.text().trim();
              url = $el.attr("href") || "";
            }

            if (!title || !url) {
              return;
            }

            title = this.cleanTitle(title);
            if (title.length < 10) return;

            if (url.startsWith("/")) {
              url = "https://www.bbc.com" + url;
            }

            if (!this.isValidUrl(url) || !url.includes("/indonesia/")) {
              return;
            }

            let publishedAt = new Date();
            const timeEl = $el.find("time").first();
            if (timeEl.length) {
              const datetime = timeEl.attr("datetime") || timeEl.text().trim();
              if (datetime) {
                publishedAt = this.parseDate(datetime);
              }
            }

            if (articles.some((article) => article.url === url)) {
              return;
            }

            articles.push({
              title,
              url,
              publishedAt,
              source: this.source,
            });
          } catch (error) {
            logger.debug("Error processing HTML element", { error });
          }
        });

        if (articles.length > 0) {
          logger.debug(
            `Successfully extracted ${articles.length} articles using selector: ${selector}`
          );
          break;
        }
      }

      return articles
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, 15);
    } catch (error: any) {
      logger.error("HTML scraping failed for BBC Indonesia", {
        error: error.message,
      });
      throw error;
    }
  }
}
