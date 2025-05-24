import axios from "axios";
import { logger } from "../utils/logger.js";
import { highlightKeywords } from "../utils/keywords.js";
import type { Article } from "./database.js";

interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: {
    text: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
}

export class DiscordService {
  private webhookUrl: string;
  private rateLimiter: Map<string, number> = new Map();

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendArticle(article: Article): Promise<boolean> {
    try {
      if (this.isRateLimited()) {
        logger.warn("Rate limited, skipping Discord message");
        return false;
      }

      const embed = this.createEmbedFromArticle(article);
      const message: DiscordMessage = {
        embeds: [embed],
      };

      const response = await axios.post(this.webhookUrl, message, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.status === 204) {
        logger.debug("Successfully sent article to Discord", {
          title: article.title,
          source: article.source,
        });
        this.updateRateLimit();
        return true;
      } else {
        logger.warn("Unexpected response from Discord", {
          status: response.status,
          statusText: response.statusText,
        });
        return false;
      }
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 429) {
          logger.warn("Discord API rate limit exceeded", {
            retryAfter: data?.retry_after,
          });
          this.handleRateLimit(data?.retry_after);
        } else {
          logger.error("Discord API error", {
            status,
            statusText: error.response.statusText,
            data,
          });
        }
      } else if (error.request) {
        logger.error("Network error sending to Discord", {
          message: error.message,
        });
      } else {
        logger.error("Error sending to Discord", {
          message: error.message,
        });
      }
      return false;
    }
  }

  private createEmbedFromArticle(article: Article): DiscordEmbed {
    const highlightedTitle = highlightKeywords(
      article.title,
      article.matchedKeywords
    );

    const colors = {
      "CNN Indonesia": 0xff0000, // Red
      "Detik.com": 0x0066cc, // Blue
      "BBC Indonesia": 0xbb1919, // BBC Red
      default: 0x1e88e5, // Default blue
    };

    const color =
      colors[article.source as keyof typeof colors] || colors.default;

    const timestamp = article.publishedAt.toISOString();

    const embed: DiscordEmbed = {
      title: this.truncateText(highlightedTitle, 256),
      url: article.url,
      color,
      timestamp,
      footer: {
        text: article.source,
      },
    };

    if (article.matchedKeywords.length > 0) {
      embed.fields = [
        {
          name: "🎯 Matched Keywords",
          value: article.matchedKeywords.map((k) => `\`${k}\``).join(", "),
          inline: true,
        },
        {
          name: "🕒 Published",
          value: this.formatRelativeTime(article.publishedAt),
          inline: true,
        },
      ];
    }

    return embed;
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + "...";
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return "Just now";
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else {
      return `${diffDays}d ago`;
    }
  }

  private isRateLimited(): boolean {
    const now = Date.now();
    const lastSent = this.rateLimiter.get("last_sent") || 0;
    const minInterval = 2000;

    return now - lastSent < minInterval;
  }

  private updateRateLimit(): void {
    this.rateLimiter.set("last_sent", Date.now());
  }

  private handleRateLimit(retryAfter?: number): void {
    const delay = retryAfter ? retryAfter * 1000 : 60000; // Default 1 minute
    const resumeTime = Date.now() + delay;
    this.rateLimiter.set("rate_limited_until", resumeTime);
  }

  async sendBulkArticles(
    articles: Article[],
    maxPerBatch: number = 5
  ): Promise<number> {
    let successCount = 0;

    for (let i = 0; i < articles.length && i < maxPerBatch; i++) {
      const article = articles[i];

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      const success = await this.sendArticle(article);
      if (success) {
        successCount++;
      } else {
        logger.warn("Failed to send article, stopping batch", {
          title: article.title,
        });
        break;
      }
    }

    logger.info(
      `Sent ${successCount}/${Math.min(articles.length, maxPerBatch)} articles to Discord`
    );
    return successCount;
  }

  async testConnection(): Promise<boolean> {
    try {
      const testMessage: DiscordMessage = {
        embeds: [
          {
            title: "🤖 Pemerintah Bot - Test Connection",
            description: "Bot is online and ready to monitor news!",
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
            footer: {
              text: "System Test",
            },
          },
        ],
      };

      const response = await axios.post(this.webhookUrl, testMessage, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

      return response.status === 204;
    } catch (error) {
      logger.error("Discord connection test failed", { error });
      return false;
    }
  }
}
