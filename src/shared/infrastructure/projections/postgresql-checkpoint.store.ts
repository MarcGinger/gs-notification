import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Log, componentLogger, Logger } from '../../logging';
import { CheckpointPosition, CheckpointStore } from './checkpoint.store';
import { DATA_SOURCE } from '../../constants/injection-tokens';

const APP_LOGGER = 'APP_LOGGER';
const COMPONENT = 'PostgreSQLCheckpointStore';

/**
 * Production-ready PostgreSQL checkpoint store for SQL-only projectors
 *
 * Features:
 * - Full {commit, prepare} position storage (no precision loss)
 * - JSONB storage for structured data and efficient querying
 * - UPSERT with version-based concurrency control
 * - Structured Pino logging
 * - Optional TTL via expires_at column
 * - Batched operations for admin functions
 * - Compare-and-set for concurrent writers
 * - Environment namespacing for isolation
 *
 * Table Schema:
 * ```sql
 * CREATE TABLE IF NOT EXISTS projection_checkpoints (
 *   key VARCHAR(255) PRIMARY KEY,
 *   commit_position BIGINT NOT NULL,
 *   prepare_position BIGINT NOT NULL,
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   expires_at TIMESTAMP WITH TIME ZONE,
 *   metadata JSONB DEFAULT '{}'::jsonb
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_checkpoints_expires_at
 *   ON projection_checkpoints(expires_at) WHERE expires_at IS NOT NULL;
 * CREATE INDEX IF NOT EXISTS idx_checkpoints_updated_at
 *   ON projection_checkpoints(updated_at);
 * ```
 */
@Injectable()
export class PostgreSQLCheckpointStore implements CheckpointStore {
  private readonly prefix: string;
  private readonly tableName = 'projection_checkpoints';
  private readonly logger: Logger;

  constructor(
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource,
    @Inject(APP_LOGGER) logger: Logger,
    // Pass env/service to avoid collisions, e.g. 'prod:', 'dev:', etc.
    envPrefix: string = '',
  ) {
    // create component-scoped child logger
    this.logger = componentLogger(logger, COMPONENT);
    this.prefix = `${envPrefix}checkpoint:`; // e.g. 'prod:checkpoint:'

    // Initialize table on startup
    this.initializeTable().catch((error) => {
      Log.error(this.logger, 'Failed to initialize checkpoint table', {
        method: 'constructor',
        error: (error as Error).message,
      });
    });
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Initialize the checkpoint table with proper schema
   */
  private async initializeTable(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          key VARCHAR(255) PRIMARY KEY,
          commit_position BIGINT NOT NULL,
          prepare_position BIGINT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE,
          metadata JSONB DEFAULT '{}'::jsonb
        );
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_checkpoints_expires_at 
          ON ${this.tableName}(expires_at) WHERE expires_at IS NOT NULL;
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_checkpoints_updated_at 
          ON ${this.tableName}(updated_at);
      `);

      // Clean up expired checkpoints on startup
      await this.cleanupExpired();

      Log.info(this.logger, 'Checkpoint table initialized successfully', {
        method: 'initializeTable',
        tableName: this.tableName,
      });
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to initialize checkpoint table', {
        method: 'initializeTable',
        tableName: this.tableName,
        error: e.message,
        stack: e.stack,
      });
      throw e;
    }
  }

  /**
   * Clean up expired checkpoints
   */
  private async cleanupExpired(): Promise<void> {
    try {
      const result = await this.dataSource.query(`
        DELETE FROM ${this.tableName} 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
      `);

      if (result.affectedRows && result.affectedRows > 0) {
        Log.info(this.logger, 'Cleaned up expired checkpoints', {
          method: 'cleanupExpired',
          deleted: result.affectedRows,
        });
      }
    } catch (error) {
      const e = error as Error;
      Log.warn(this.logger, 'Failed to cleanup expired checkpoints', {
        method: 'cleanupExpired',
        error: e.message,
      });
    }
  }

  /**
   * Get checkpoint position with full commit/prepare details
   */
  async get(key: string): Promise<CheckpointPosition | null> {
    try {
      const result = await this.dataSource.query(
        `SELECT commit_position, prepare_position, updated_at 
         FROM ${this.tableName} 
         WHERE key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [this.k(key)],
      );

      if (!result || result.length === 0) {
        Log.debug(this.logger, 'Checkpoint not found', {
          method: 'get',
          key,
        });
        return null;
      }

      const row = result[0];
      const position: CheckpointPosition = {
        commit: row.commit_position.toString(),
        prepare: row.prepare_position.toString(),
        updatedAt: row.updated_at?.toISOString(),
      };

      Log.debug(this.logger, 'Checkpoint retrieved', {
        method: 'get',
        key,
        commit: position.commit,
        prepare: position.prepare,
      });

      return position;
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to get checkpoint', {
        method: 'get',
        key,
        error: e.message,
        stack: e.stack,
      });
      return null;
    }
  }

  /**
   * Set checkpoint position with optional TTL
   */
  async set(
    key: string,
    pos: CheckpointPosition,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = ttlSeconds
        ? new Date(now.getTime() + ttlSeconds * 1000)
        : null;

      await this.dataSource.query(
        `INSERT INTO ${this.tableName} (key, commit_position, prepare_position, updated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key) 
         DO UPDATE SET 
           commit_position = EXCLUDED.commit_position,
           prepare_position = EXCLUDED.prepare_position,
           updated_at = EXCLUDED.updated_at,
           expires_at = EXCLUDED.expires_at`,
        [
          this.k(key),
          BigInt(pos.commit),
          BigInt(pos.prepare),
          pos.updatedAt ? new Date(pos.updatedAt) : now,
          expiresAt,
        ],
      );

      Log.debug(this.logger, 'Checkpoint set', {
        method: 'set',
        key,
        commit: pos.commit,
        prepare: pos.prepare,
        ttlSeconds: ttlSeconds ?? null,
      });
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to set checkpoint', {
        method: 'set',
        key,
        position: pos,
        error: e.message,
        stack: e.stack,
      });
      throw e;
    }
  }

  /**
   * Delete checkpoint
   */
  async delete(key: string): Promise<void> {
    try {
      await this.dataSource.query(
        `DELETE FROM ${this.tableName} WHERE key = $1`,
        [this.k(key)],
      );

      Log.debug(this.logger, 'Checkpoint deleted', {
        method: 'delete',
        key,
      });
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to delete checkpoint', {
        method: 'delete',
        key,
        error: e.message,
        stack: e.stack,
      });
      throw e;
    }
  }

  /**
   * Check if checkpoint exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.dataSource.query(
        `SELECT 1 FROM ${this.tableName} 
         WHERE key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [this.k(key)],
      );
      return result && result.length > 0;
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to check checkpoint existence', {
        method: 'exists',
        key,
        error: e.message,
        stack: e.stack,
      });
      return false;
    }
  }

  /**
   * Scan for checkpoint keys with pagination
   */
  async scan(prefix = '*', pageSize = 500): Promise<string[]> {
    try {
      const pattern =
        prefix === '*' ? `${this.prefix}%` : `${this.prefix}${prefix}%`;

      const result = await this.dataSource.query(
        `SELECT key FROM ${this.tableName} 
         WHERE key LIKE $1 AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY key
         LIMIT $2`,
        [pattern, pageSize],
      );

      const keys = result.map((row) => row.key.replace(this.prefix, ''));

      Log.debug(this.logger, 'Checkpoint keys scanned', {
        method: 'scan',
        prefix,
        count: keys.length,
        pageSize,
      });

      return keys;
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to scan checkpoint keys', {
        method: 'scan',
        prefix,
        pageSize,
        error: e.message,
        stack: e.stack,
      });
      return [];
    }
  }

  /**
   * Get all checkpoints with pagination
   */
  async getAll(
    prefix = '*',
    pageSize = 500,
  ): Promise<Record<string, CheckpointPosition>> {
    const result: Record<string, CheckpointPosition> = {};

    try {
      const pattern =
        prefix === '*' ? `${this.prefix}%` : `${this.prefix}${prefix}%`;

      const rows = await this.dataSource.query(
        `SELECT key, commit_position, prepare_position, updated_at 
         FROM ${this.tableName} 
         WHERE key LIKE $1 AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY key
         LIMIT $2`,
        [pattern, pageSize],
      );

      for (const row of rows) {
        const cleanKey = row.key.replace(this.prefix, '');
        result[cleanKey] = {
          commit: row.commit_position.toString(),
          prepare: row.prepare_position.toString(),
          updatedAt: row.updated_at?.toISOString(),
        };
      }

      Log.debug(this.logger, 'All checkpoints retrieved', {
        method: 'getAll',
        prefix,
        count: Object.keys(result).length,
        pageSize,
      });

      return result;
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to get all checkpoints', {
        method: 'getAll',
        prefix,
        pageSize,
        error: e.message,
        stack: e.stack,
      });
      return {};
    }
  }

  /**
   * Clear checkpoints with pagination
   */
  async clear(prefix = '*', pageSize = 500): Promise<number> {
    try {
      const pattern =
        prefix === '*' ? `${this.prefix}%` : `${this.prefix}${prefix}%`;

      const result = await this.dataSource.query(
        `DELETE FROM ${this.tableName} 
         WHERE key LIKE $1
         AND key IN (
           SELECT key FROM ${this.tableName} 
           WHERE key LIKE $1 
           ORDER BY key 
           LIMIT $2
         )`,
        [pattern, pageSize],
      );

      const deleted = result.affectedRows || 0;

      Log.info(this.logger, 'Checkpoints cleared', {
        method: 'clear',
        prefix,
        deleted,
        pageSize,
      });

      return deleted;
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to clear checkpoints', {
        method: 'clear',
        prefix,
        pageSize,
        error: e.message,
        stack: e.stack,
      });
      throw e;
    }
  }

  /**
   * Compare-and-set: only update if incoming commit >= stored commit
   * Prevents regressions from concurrent writers with clock skew
   */
  async setIfNewer(
    key: string,
    pos: CheckpointPosition,
    ttlSeconds?: number,
  ): Promise<boolean> {
    try {
      const now = new Date();
      const updatedAt = pos.updatedAt ? new Date(pos.updatedAt) : now;
      const expiresAt = ttlSeconds
        ? new Date(now.getTime() + ttlSeconds * 1000)
        : null;

      const result = await this.dataSource.query(
        `INSERT INTO ${this.tableName} (key, commit_position, prepare_position, updated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key) 
         DO UPDATE SET 
           commit_position = EXCLUDED.commit_position,
           prepare_position = EXCLUDED.prepare_position,
           updated_at = EXCLUDED.updated_at,
           expires_at = EXCLUDED.expires_at
         WHERE ${this.tableName}.commit_position <= EXCLUDED.commit_position`,
        [
          this.k(key),
          BigInt(pos.commit),
          BigInt(pos.prepare),
          updatedAt,
          expiresAt,
        ],
      );

      const updated =
        result.affectedRows !== undefined && result.affectedRows > 0;

      Log.debug(this.logger, 'Compare-and-set checkpoint', {
        method: 'setIfNewer',
        key,
        commit: pos.commit,
        prepare: pos.prepare,
        updated,
        ttlSeconds: ttlSeconds ?? null,
      });

      return updated;
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to compare-and-set checkpoint', {
        method: 'setIfNewer',
        key,
        position: pos,
        error: e.message,
        stack: e.stack,
      });
      return false;
    }
  }
}
