import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { BaseScraper, NewsItem, ScrapedResult } from "./base.js";
import { logger } from "../utils/logger.js";

export class KompasScraper extends BaseScraper {
  private rssParser: Parser;
  private readonly RSS_URLS = [
    "https://rss.kompas.com/api/feed/social?apikey=bc58c81819dff4b8d5c53540a2fc7ffd83e6314a", // Main RSS feed
  ];
  private readonly BASE_URL = "https://www.kompas.com";

  constructor(userAgent: string) {
    super("Kompas.com", userAgent);
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
          `Successfully scraped ${rssArticles.length} articles from Kompas RSS`
        );
      } else {
        logger.info("RSS failed, falling back to HTML scraping for Kompas");
        const htmlArticles = await this.scrapeViaHTML();
        result.articles = htmlArticles;
        result.success = htmlArticles.length > 0;
        logger.info(`Scraped ${htmlArticles.length} articles from Kompas HTML`);
      }

      this.setLastScrapeTime();
    } catch (error: any) {
      const errorMessage = `Kompas scraping failed: ${error.message}`;
      result.errors.push(errorMessage);
      logger.error(errorMessage, { error });
    }

    return result;
  }

  private async scrapeViaRSS(): Promise<NewsItem[]> {
    const articles: NewsItem[] = [];

    for (const rssUrl of this.RSS_URLS) {
      try {
        logger.debug(`Trying RSS feed: ${rssUrl}`);
        const feed = await this.rssParser.parseURL(rssUrl);

        if (!feed.items || feed.items.length === 0) {
          logger.warn(`No items found in Kompas RSS feed: ${rssUrl}`);
          continue;
        }

        for (const item of feed.items.slice(0, 15)) {
          try {
            if (!item.title || !item.link) {
              continue;
            }

            const publishedAt = item.pubDate
              ? new Date(item.pubDate)
              : new Date();

            // Skip articles older than 48 hours
            const now = new Date();
            const hoursDiff =
              (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
            if (hoursDiff > 48) {
              continue;
            }

            if (articles.some((article) => article.url === item.link)) {
              continue;
            }

            articles.push({
              title: this.cleanTitle(item.title),
              url: item.link,
              publishedAt,
              source: this.source,
            });
          } catch (error) {
            logger.warn("Error processing RSS item", {
              error,
              item: item.title,
            });
          }
        }

        logger.debug(`Collected ${articles.length} articles from ${rssUrl}`);
      } catch (error: any) {
        logger.warn(`RSS parsing failed for ${rssUrl}`, {
          error: error.message,
        });
      }
    }

    if (articles.length === 0) {
      throw new Error("All RSS feeds failed or returned no articles");
    }

    const uniqueArticles = articles.filter(
      (article, index, self) =>
        index === self.findIndex((a) => a.url === article.url)
    );

    return uniqueArticles
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, 20);
  }

  private async scrapeViaHTML(): Promise<NewsItem[]> {
    try {
      const response = await this.httpClient.get(this.BASE_URL);
      const $ = cheerio.load(response.data);
      const articles: NewsItem[] = [];

      const selectors = [
        ".article__list .article__item", // Main article list
        ".headline .article__item", // Headline articles
        ".latest .article__item", // Latest articles
        ".terkini .article__item", // Terkini (latest) articles
        "article", // Generic article elements
        ".list-berita .item", // News list items
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

            // Pattern 1: Title and link in nested elements
            const linkEl = $el.find('a[href*="kompas.com"]').first();
            if (linkEl.length) {
              url = linkEl.attr("href") || "";
              title =
                linkEl.text().trim() ||
                linkEl.find("h2, h3, .article__title").text().trim();
            }

            // Pattern 2: Direct link element
            if (!title && $el.is('a[href*="kompas.com"]')) {
              title = $el.text().trim();
              url = $el.attr("href") || "";
            }

            // Pattern 3: Title in specific Kompas classes
            if (!title) {
              const titleEl = $el
                .find(".article__title, .title, h2, h3")
                .first();
              if (titleEl.length) {
                title = titleEl.text().trim();
                url = $el.find("a").first().attr("href") || "";
              }
            }

            if (!title || !url) {
              return;
            }

            title = this.cleanTitle(title);
            if (title.length < 10) return;

            url = this.makeAbsoluteUrl(url, this.BASE_URL);
            if (!this.isValidUrl(url) || !url.includes("kompas.com")) {
              return;
            }

            let publishedAt = new Date();
            const dateEl = $el
              .find(".article__date, .date, .time, time")
              .first();
            if (dateEl.length) {
              const dateText =
                dateEl.text().trim() || dateEl.attr("datetime") || "";
              if (dateText) {
                publishedAt = this.parseDate(dateText);
              }
            }

            // Skip articles older than 48 hours
            const now = new Date();
            const hoursDiff =
              (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
            if (hoursDiff > 48) {
              return;
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
            logger.warn("Error processing HTML element", { error });
          }
        });

        if (articles.length >= 20) break;
      }

      return articles
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, 20);
    } catch (error: any) {
      logger.error("HTML scraping failed for Kompas", { error });
      throw error;
    }
  }
}
