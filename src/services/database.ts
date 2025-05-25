import { Database } from "bun:sqlite";
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
  imageUrl?: string;
  description?: string;
}

class DatabaseService {
  private db: Database | null = null;
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

      this.db = new Database(this.dbPath);

      this.createTables();

      logger.info("Database initialized successfully", { path: this.dbPath });
    } catch (error) {
      logger.error("Failed to initialize database", {
        error,
        path: this.dbPath,
      });
      throw error;
    }
  }

  private createTables(): void {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        published_at DATETIME NOT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        matched_keywords TEXT NOT NULL,
        image_url TEXT,
        description TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
      CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
      CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
    `;

    this.db.run(createTableSQL);
  }

  async isArticleProcessed(url: string): Promise<boolean> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const query = this.db.query("SELECT 1 FROM articles WHERE url = ? LIMIT 1");
    const row = query.get(url);
    return !!row;
  }

  async saveArticle(article: Omit<Article, "id">): Promise<number> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
      const query = this.db.query(`
        INSERT OR IGNORE INTO articles (url, title, source, published_at, processed_at, matched_keywords, image_url, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = query.run(
        article.url,
        article.title,
        article.source,
        article.publishedAt.toISOString(),
        article.processedAt.toISOString(),
        JSON.stringify(article.matchedKeywords),
        article.imageUrl || null,
        article.description || null
      );

      // If no rows were affected, the article already exists
      if (result.changes === 0) {
        logger.debug("Article already exists in database", {
          url: article.url,
        });
        // Return the existing article ID
        const existingQuery = this.db.query(
          "SELECT id FROM articles WHERE url = ?"
        );
        const existing = existingQuery.get(article.url) as {
          id: number;
        } | null;
        return existing?.id || 0;
      }

      return result.lastInsertRowid as number;
    } catch (error) {
      logger.error("Failed to save article to database", {
        error,
        url: article.url,
        title: article.title,
      });
      throw error;
    }
  }

  async getRecentArticles(
    source?: string,
    limit: number = 50
  ): Promise<Article[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    let queryText = `
      SELECT id, url, title, source, published_at, processed_at, matched_keywords, image_url, description
      FROM articles
    `;
    const params: (string | number)[] = [];

    if (source) {
      queryText += " WHERE source = ?";
      params.push(source);
    }

    queryText += " ORDER BY processed_at DESC LIMIT ?";
    params.push(limit);

    const query = this.db.query(queryText);
    const rows = query.all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      source: row.source,
      publishedAt: new Date(row.published_at),
      processedAt: new Date(row.processed_at),
      matchedKeywords: JSON.parse(row.matched_keywords),
      imageUrl: row.image_url || undefined,
      description: row.description || undefined,
    }));
  }

  async cleanup(olderThanDays: number = 30): Promise<number> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const query = this.db.query("DELETE FROM articles WHERE processed_at < ?");
    const result = query.run(cutoffDate.toISOString());

    return result.changes;
  }

  async getStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
  }> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const totalQuery = this.db.query("SELECT COUNT(*) as total FROM articles");
    const totalResult = totalQuery.get() as { total: number };

    const sourceQuery = this.db.query(
      "SELECT source, COUNT(*) as count FROM articles GROUP BY source"
    );
    const sourceResults = sourceQuery.all() as Array<{
      source: string;
      count: number;
    }>;

    const bySource: Record<string, number> = {};
    sourceResults.forEach((row) => {
      bySource[row.source] = row.count;
    });

    return {
      total: totalResult.total,
      bySource,
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export { DatabaseService };
