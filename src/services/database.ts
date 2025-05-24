import Database from "sqlite3";
import { dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import { logger } from "../utils/logger.js";

export interface Article {
  id?: number;
  url: string;
  title: string;
  source: string;
  publishedAt: Date;
  processedAt: Date;
  matchedKeywords: string[];
}

class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    try {
      const dbDir = dirname(this.dbPath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      this.db = new Database.Database(this.dbPath);

      await this.createTables();

      logger.info("Database initialized successfully", { path: this.dbPath });
    } catch (error) {
      logger.error("Failed to initialize database", {
        error,
        path: this.dbPath,
      });
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          source TEXT NOT NULL,
          published_at DATETIME NOT NULL,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          matched_keywords TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
        CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
        CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
      `;

      this.db.exec(createTableSQL, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async isArticleProcessed(url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const query = "SELECT 1 FROM articles WHERE url = ? LIMIT 1";
      this.db.get(query, [url], (error, row) => {
        if (error) {
          reject(error);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  async saveArticle(article: Omit<Article, "id">): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const query = `
        INSERT INTO articles (url, title, source, published_at, processed_at, matched_keywords)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const params = [
        article.url,
        article.title,
        article.source,
        article.publishedAt.toISOString(),
        article.processedAt.toISOString(),
        JSON.stringify(article.matchedKeywords),
      ];

      this.db.run(query, params, function (error) {
        if (error) {
          reject(error);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getRecentArticles(
    source?: string,
    limit: number = 50
  ): Promise<Article[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      let query = `
        SELECT id, url, title, source, published_at, processed_at, matched_keywords
        FROM articles
      `;
      const params: any[] = [];

      if (source) {
        query += " WHERE source = ?";
        params.push(source);
      }

      query += " ORDER BY processed_at DESC LIMIT ?";
      params.push(limit);

      this.db.all(query, params, (error, rows: any[]) => {
        if (error) {
          reject(error);
        } else {
          const articles: Article[] = rows.map((row) => ({
            id: row.id,
            url: row.url,
            title: row.title,
            source: row.source,
            publishedAt: new Date(row.published_at),
            processedAt: new Date(row.processed_at),
            matchedKeywords: JSON.parse(row.matched_keywords),
          }));
          resolve(articles);
        }
      });
    });
  }

  async cleanup(olderThanDays: number = 30): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const query = "DELETE FROM articles WHERE processed_at < ?";
      this.db.run(query, [cutoffDate.toISOString()], function (error) {
        if (error) {
          reject(error);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async getStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      this.db.get(
        "SELECT COUNT(*) as total FROM articles",
        (error, totalRow: any) => {
          if (error) {
            reject(error);
            return;
          }

          this.db?.all(
            "SELECT source, COUNT(*) as count FROM articles GROUP BY source",
            (error, sourceRows: any[]) => {
              if (error) {
                reject(error);
              } else {
                const bySource: Record<string, number> = {};
                sourceRows.forEach((row) => {
                  bySource[row.source] = row.count;
                });

                resolve({
                  total: totalRow.total,
                  bySource,
                });
              }
            }
          );
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.db = null;
          resolve();
        }
      });
    });
  }
}

export { DatabaseService };
