import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import { withTimeout } from '../timeout.helper';

@Injectable()
export class PostgresHealthIndicator {
  constructor(
    private readonly dataSource: DataSource,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async ping(
    key = 'postgres',
    timeoutMs = 1500,
  ): Promise<HealthIndicatorResult> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      const startTime = Date.now();
      await withTimeout(this.dataSource.query('SELECT 1'), timeoutMs);
      const responseTime = Date.now() - startTime;

      const pending = await this.dataSource.showMigrations();
      return this.healthIndicatorService
        .check(key)
        .up({ pendingMigrations: pending, responseTime });
    } catch (err) {
      return this.healthIndicatorService
        .check(key)
        .down({ error: (err as Error)?.message });
    }
  }

  async getDetailedInfo(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
    details?: Record<string, any>;
    error?: string;
  }> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      const startTime = Date.now();

      // Get database version and connection info
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Reason: Legacy pattern, result type is dynamic. Ticket: TICKET-REQUIRED
      const [versionResult, connectionResult, migrationsResult] =
        await Promise.all([
          withTimeout(this.dataSource.query('SELECT version()'), 1500).catch(
            () => null,
          ),
          withTimeout(
            this.dataSource.query(
              'SELECT current_database(), current_user, current_timestamp',
            ),
            1500,
          ).catch(() => null),
          withTimeout(this.dataSource.showMigrations(), 1500).catch(
            () => [] as string[],
          ),
        ]);

      const responseTime = Date.now() - startTime;

      const details: Record<string, unknown> = {
        initialized: this.dataSource.isInitialized,
        databaseName: this.dataSource.options.database || 'unknown',
        driverType: this.dataSource.options.type,
      };

      if (versionResult && Array.isArray(versionResult) && versionResult[0]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Reason: Legacy pattern, result type is dynamic. Ticket: TICKET-REQUIRED
        details.version = versionResult[0].version;
      }

      if (
        connectionResult &&
        Array.isArray(connectionResult) &&
        connectionResult[0]
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Reason: Legacy pattern, result type is dynamic. Ticket: TICKET-REQUIRED
        const conn = connectionResult[0];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Reason: Legacy pattern, result type is dynamic. Ticket: TICKET-REQUIRED
        details.currentDatabase = conn.current_database;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Reason: Legacy pattern, result type is dynamic. Ticket: TICKET-REQUIRED
        details.currentUser = conn.current_user;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Reason: Legacy pattern, result type is dynamic. Ticket: TICKET-REQUIRED
        details.serverTime = conn.current_timestamp;
      }

      details.pendingMigrations = Array.isArray(migrationsResult)
        ? migrationsResult.length
        : 0;
      if (Array.isArray(migrationsResult) && migrationsResult.length > 0) {
        details.migrationsList = migrationsResult.slice(0, 5); // Show first 5
      }

      return {
        status: 'healthy',
        responseTime,
        details,
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        error: (err as Error)?.message,
      };
    }
  }
}
