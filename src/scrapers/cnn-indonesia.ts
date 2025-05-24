import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { BaseScraper, NewsItem, ScrapedResult } from "./base.js";
import { logger } from "../utils/logger.js";

export class CNNIndonesiaScraper extends BaseScraper {
  private rssParser: Parser;
  private readonly RSS_URL = "https://www.cnnindonesia.com/rss";
  private readonly BASE_URL = "https://www.cnnindonesia.com";

  constructor(userAgent: string) {
    super("CNN Indonesia", userAgent);
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
          `Successfully scraped ${rssArticles.length} articles from CNN Indonesia RSS`
        );
      } else {
        logger.info(
          "RSS failed, falling back to HTML scraping for CNN Indonesia"
        );
        const htmlArticles = await this.scrapeViaHTML();
        result.articles = htmlArticles;
        result.success = htmlArticles.length > 0;
        logger.info(
          `Scraped ${htmlArticles.length} articles from CNN Indonesia HTML`
        );
      }

      this.setLastScrapeTime();
    } catch (error: any) {
      const errorMessage = `CNN Indonesia scraping failed: ${error.message}`;
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
        logger.warn("No items found in CNN Indonesia RSS feed");
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
          if (hoursDiff > 24) {
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
      logger.error("RSS parsing failed for CNN Indonesia", {
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
        ".list-content .content-item", // Main content list
        ".media__list .media__item", // Media list items
        ".list .item", // Generic list items
        "article", // Article elements
        ".news-item", // News items
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

            // Pattern 1: Title in h2 or h3, link in a
            const titleEl = $el
              .find("h2 a, h3 a, .media__title a, .title a")
              .first();
            if (titleEl.length) {
              title = titleEl.text().trim();
              url = titleEl.attr("href") || "";
            }

            // Pattern 2: Title in data attributes or text content
            if (!title) {
              title = $el
                .find(".title, .headline, h2, h3")
                .first()
                .text()
                .trim();
              url = $el.find("a").first().attr("href") || "";
            }

            // Pattern 3: Direct link element
            if (!title && $el.is("a")) {
              title = $el.text().trim();
              url = $el.attr("href") || "";
            }

            if (!title || !url) {
              return;
            }

            title = this.cleanTitle(title);
            if (title.length < 10) return;

            url = this.makeAbsoluteUrl(url, this.BASE_URL);
            if (!this.isValidUrl(url)) return;

            let publishedAt = new Date();
            const dateEl = $el
              .find(".date, .time, .publish-date, time")
              .first();
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
      logger.error("HTML scraping failed for CNN Indonesia", {
        error: error.message,
      });
      throw error;
    }
  }
}
