import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { BaseScraper, NewsItem, ScrapedResult } from "./base.js";
import { logger } from "../utils/logger.js";

export class DetikScraper extends BaseScraper {
  private rssParser: Parser;
  private readonly RSS_URLS = [
    "https://news.detik.com/berita/rss", // News RSS (updated URL)
    "https://finance.detik.com/rss", // Finance RSS (updated URL)
  ];
  private readonly BASE_URL = "https://www.detik.com";

  constructor(userAgent: string) {
    super("Detik.com", userAgent);
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
          `Successfully scraped ${rssArticles.length} articles from Detik RSS`
        );
      } else {
        logger.info("RSS failed, falling back to HTML scraping for Detik");
        const htmlArticles = await this.scrapeViaHTML();
        result.articles = htmlArticles;
        result.success = htmlArticles.length > 0;
        logger.info(`Scraped ${htmlArticles.length} articles from Detik HTML`);
      }

      this.setLastScrapeTime();
    } catch (error: any) {
      const errorMessage = `Detik scraping failed: ${error.message}`;
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
          logger.warn(`No items found in Detik RSS feed: ${rssUrl}`);
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
        ".list-content .list-item", // Main list items
        ".list-news .item", // News list items
        ".list li", // Generic list items
        "article", // Article elements
        ".media", // Media items
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
            const linkEl = $el.find('a[href*="/read/"]').first();
            if (linkEl.length) {
              url = linkEl.attr("href") || "";
              title =
                linkEl.text().trim() ||
                linkEl.find("h2, h3, .title").text().trim();
            }

            // Pattern 2: Direct link element
            if (!title && $el.is('a[href*="/read/"]')) {
              title = $el.text().trim();
              url = $el.attr("href") || "";
            }

            // Pattern 3: Title in specific Detik classes
            if (!title) {
              const titleEl = $el.find(".media__title, .title, h2, h3").first();
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
            if (!this.isValidUrl(url) || !url.includes("/read/")) {
              return;
            }

            let publishedAt = new Date();
            const dateEl = $el.find(".date, .time, .media__date, time").first();
            if (dateEl.length) {
              const dateText =
                dateEl.text().trim() || dateEl.attr("datetime") || "";
              if (dateText) {
                publishedAt = this.parseDate(dateText);
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

        // If we found articles with this selector, use them and stop
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
      logger.error("HTML scraping failed for Detik", { error: error.message });
      throw error;
    }
  }
}
