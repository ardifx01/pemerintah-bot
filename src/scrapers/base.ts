import axios, { AxiosInstance } from "axios";
import { logger } from "../utils/logger.js";

export interface NewsItem {
  title: string;
  url: string;
  publishedAt: Date;
  source: string;
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
