import axios, { AxiosInstance } from "axios";
import * as cheerio from "cheerio";
import { logger } from "../utils/logger";

export interface NewsItem {
  title: string;
  url: string;
  publishedAt: Date;
  source: string;
  imageUrl?: string;
  description?: string;
}

export interface ScrapedResult {
  articles: NewsItem[];
  success: boolean;
  errors: string[];
}

export abstract class BaseScraper {
  protected source: string;
  protected httpClient: AxiosInstance;
  protected lastScrapeTime: Date | null = null;

  constructor(
    source: string,
    userAgent: string = "Mozilla/5.0 (compatible; NewsBot/1.0)"
  ) {
    this.source = source;
    this.httpClient = axios.create({
      timeout: 15000,
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug(`Making request to ${config.url}`, {
          method: config.method,
          source: this.source,
        });
        return config;
      },
      (error) => {
        logger.error("Request interceptor error", {
          error,
          source: this.source,
        });
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug(`Received response from ${response.config.url}`, {
          status: response.status,
          contentLength: response.headers["content-length"],
          source: this.source,
        });
        return response;
      },
      (error) => {
        if (error.response) {
          logger.warn("HTTP error response", {
            status: error.response.status,
            statusText: error.response.statusText,
            url: error.config?.url,
            source: this.source,
          });
        } else if (error.request) {
          logger.error("Network error", {
            message: error.message,
            url: error.config?.url,
            source: this.source,
          });
        } else {
          logger.error("Request setup error", {
            message: error.message,
            source: this.source,
          });
        }
        return Promise.reject(error);
      }
    );
  }

  abstract scrapeNews(): Promise<ScrapedResult>;

  /**
   * Fetch article metadata including image and description
   */
  protected async fetchArticleMetadata(
    url: string
  ): Promise<{ imageUrl?: string; description?: string }> {
    try {
      logger.debug(`Fetching metadata for article: ${url}`);

      const response = await this.httpClient.get(url);
      const $ = cheerio.load(response.data);

      // Extract OG image
      let imageUrl =
        $('meta[property="og:image"]').attr("content") ||
        $('meta[name="twitter:image"]').attr("content") ||
        $('meta[property="og:image:url"]').attr("content");

      // Make image URL absolute if needed
      if (imageUrl && !this.isValidUrl(imageUrl)) {
        imageUrl = this.makeAbsoluteUrl(imageUrl, url);
      }

      // Extract description from meta tags first
      let description =
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        $('meta[name="twitter:description"]').attr("content");

      // If no meta description, try to extract from article content
      if (!description) {
        description = this.extractArticlePreview($, url);
      }

      // Clean and limit description length
      if (description) {
        description = this.cleanDescription(description);
      }

      logger.debug(`Metadata extracted for ${url}`, {
        hasImage: !!imageUrl,
        hasDescription: !!description,
        imageUrl:
          imageUrl?.substring(0, 100) +
          (imageUrl && imageUrl.length > 100 ? "..." : ""),
        descriptionLength: description?.length || 0,
      });

      return { imageUrl, description };
    } catch (error) {
      logger.warn(`Failed to fetch metadata for ${url}`, { error });
      return {};
    }
  }

  /**
   * Extract article preview from content
   */
  private extractArticlePreview(
    $: cheerio.CheerioAPI,
    url: string
  ): string | undefined {
    // Common selectors for article content based on Indonesian news sites
    const contentSelectors = [
      ".detail-content p", // Common for many Indonesian sites
      ".article-content p",
      ".content-body p",
      ".post-content p",
      ".entry-content p",
      "article p",
      ".article p",
      '[data-testid="article-content"] p', // BBC
      ".detail_text p", // Detik
      ".text_detail p", // CNN Indonesia
      "p", // Fallback
    ];

    for (const selector of contentSelectors) {
      const paragraphs = $(selector);

      if (paragraphs.length > 0) {
        // Get first 1-2 meaningful paragraphs
        let preview = "";
        let sentenceCount = 0;

        paragraphs.each((_, element) => {
          const text = $(element).text().trim();

          // Skip short paragraphs, ads, or navigation text
          if (
            text.length < 30 ||
            text.toLowerCase().includes("baca juga") ||
            text.toLowerCase().includes("lihat juga") ||
            text.toLowerCase().includes("advertisement") ||
            text.toLowerCase().includes("iklan") ||
            text.match(/^\d+\/\d+/) || // Skip date-like text
            text.includes("©") || // Skip copyright
            text.toLowerCase().includes("follow") ||
            text.toLowerCase().includes("subscribe")
          ) {
            return;
          }

          // Add sentences until we have 1-2 complete sentences
          const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

          for (const sentence of sentences) {
            if (sentenceCount >= 2) break;

            const cleanSentence = sentence.trim();
            if (cleanSentence.length > 20) {
              preview += (preview ? " " : "") + cleanSentence;
              sentenceCount++;
            }
          }

          if (sentenceCount >= 2) return false; // Break out of each loop
        });

        if (preview.length > 50) {
          return preview;
        }
      }
    }

    return undefined;
  }

  /**
   * Clean and format description text
   */
  private cleanDescription(description: string): string {
    return description
      .trim()
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\n|\r/g, " ") // Remove newlines
      .replace(/\t/g, " ") // Remove tabs
      .replace(/\s{2,}/g, " ") // Remove multiple spaces
      .substring(0, 300) // Limit to 300 characters for Discord
      .trim();
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected parseDate(dateString: string): Date {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      const indonesianPatterns = [
        // ISO format: 2024-01-15T10:30:00Z
        /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
        // Indonesian format: 15 Januari 2024, 10:30 WIB
        /(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i,
        // Short format: 15/01/2024
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      ];

      for (const pattern of indonesianPatterns) {
        const match = dateString.match(pattern);
        if (match) {
          try {
            const monthMap: Record<string, number> = {
              januari: 0,
              februari: 1,
              maret: 2,
              april: 3,
              mei: 4,
              juni: 5,
              juli: 6,
              agustus: 7,
              september: 8,
              oktober: 9,
              november: 10,
              desember: 11,
            };

            if (match[2] && monthMap[match[2].toLowerCase()] !== undefined) {
              const day = parseInt(match[1], 10);
              const month = monthMap[match[2].toLowerCase()];
              const year = parseInt(match[3], 10);
              return new Date(year, month, day);
            } else if (match[3]) {
              const day = parseInt(match[1], 10);
              const month = parseInt(match[2], 10) - 1;
              const year = parseInt(match[3], 10);
              return new Date(year, month, day);
            }
          } catch (error) {
            logger.warn("Error parsing date pattern", {
              dateString,
              pattern: pattern.source,
              error,
              source: this.source,
            });
          }
        }
      }

      logger.warn("Could not parse date, using current time", {
        dateString,
        source: this.source,
      });
      return new Date();
    }

    return date;
  }

  protected cleanTitle(title: string): string {
    return title
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\n|\r/g, "")
      .replace(/^\||\|$/g, "")
      .replace(/^-|-$/g, "")
      .trim();
  }

  protected isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  protected makeAbsoluteUrl(url: string, baseUrl: string): string {
    if (this.isValidUrl(url)) {
      return url;
    }

    try {
      return new URL(url, baseUrl).href;
    } catch {
      logger.warn("Could not create absolute URL", {
        url,
        baseUrl,
        source: this.source,
      });
      return url;
    }
  }

  getSource(): string {
    return this.source;
  }

  getLastScrapeTime(): Date | null {
    return this.lastScrapeTime;
  }

  protected setLastScrapeTime(): void {
    this.lastScrapeTime = new Date();
  }
}
