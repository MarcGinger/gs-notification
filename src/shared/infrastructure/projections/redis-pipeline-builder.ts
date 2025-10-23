// ⚠️ PRODUCTION-READY: Ordered Field Pairs + Safe Serialization + EVALSHA
// ✅ Array<[string,string]> prevents undefined serialization issues
// ✅ Safe boundary string conversion with proper type handling
// ✅ EVALSHA-optimized pipeline operations
// ✅ Configurable TTLs from centralized config

import type { ChainableCommander } from 'ioredis';
import { ProjectorConfig } from './projector-config';

export class RedisPipelineBuilder {
  // ✅ Ordered field pairs - prevents Record<string,string> undefined pitfalls
  static executeUpsert(
    pipeline: ChainableCommander,
    entityKey: string,
    indexKey: string,
    entityId: string,
    version: number,
    updatedAt: Date,
    fields: Array<[string, string]>, // ✅ Ordered, type-safe field pairs
  ): void {
    const flatFields = fields.flat();

    // ✅ Use EVALSHA via registered command (void for fire-and-forget)
    void pipeline.upsertEntity(
      entityKey,
      indexKey,
      entityId,
      version.toString(),
      updatedAt.getTime().toString(),
      ...flatFields,
    );
  }

  static executeSoftDelete(
    pipeline: ChainableCommander,
    entityKey: string,
    indexKey: string,
    entityId: string,
    deletedAt: Date,
    ttlSeconds: number = ProjectorConfig.DELETE_TTL_SECONDS, // ✅ Configurable TTL
  ): void {
    void pipeline.softDeleteEntity(
      entityKey,
      indexKey,
      entityId,
      deletedAt.toISOString(),
      ttlSeconds.toString(),
    );
  }

  // ✅ Safe serialization helpers - handle edge cases gracefully
  static safeJsonStringify(value: unknown): string {
    if (value === undefined) return '';
    if (value === null) return '';
    if (Array.isArray(value) && value.length === 0) return '[]';
    if (
      typeof value === 'object' &&
      value !== null &&
      Object.keys(value).length === 0
    ) {
      return '{}';
    }
    try {
      return JSON.stringify(value);
    } catch {
      return ''; // Fallback for circular references or non-serializable
    }
  }

  static safeStringify(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') {
      if (isNaN(value)) return '';
      if (!isFinite(value)) return '';
      return value.toString();
    }
    // Safe object stringification
    if (typeof value === 'object') {
      return this.safeJsonStringify(value);
    }
    // Fallback for other types
    return '';
  }

  // ✅ Build field pairs with safe serialization
  static buildFieldPairs(
    data: Record<string, unknown>,
  ): Array<[string, string]> {
    return Object.entries(data)
      .filter(([key, value]) => key && value !== undefined) // Skip empty keys and undefined
      .map(([key, value]) => [key, this.safeStringify(value)]);
  }

  // ✅ Common entity field builders (reusable patterns)
  static buildVersionedEntityFields(
    entity: {
      id: string;
      version: number;
      createdAt: Date;
      updatedAt: Date;
      [key: string]: unknown;
    },
    additionalFields?: Record<string, unknown>,
  ): Array<[string, string]> {
    const baseFields: Record<string, unknown> = {
      id: entity.id,
      version: entity.version,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      ...additionalFields,
    };

    return this.buildFieldPairs(baseFields);
  }

  // ✅ Batch operations for performance
  static executeBatchUpsert(
    pipeline: ChainableCommander,
    operations: Array<{
      entityKey: string;
      indexKey: string;
      entityId: string;
      version: number;
      updatedAt: Date;
      fields: Array<[string, string]>;
    }>,
  ): void {
    for (const op of operations) {
      this.executeUpsert(
        pipeline,
        op.entityKey,
        op.indexKey,
        op.entityId,
        op.version,
        op.updatedAt,
        op.fields,
      );
    }
  }

  static executeBatchSoftDelete(
    pipeline: ChainableCommander,
    operations: Array<{
      entityKey: string;
      indexKey: string;
      entityId: string;
      deletedAt: Date;
      ttlSeconds?: number;
    }>,
  ): void {
    for (const op of operations) {
      this.executeSoftDelete(
        pipeline,
        op.entityKey,
        op.indexKey,
        op.entityId,
        op.deletedAt,
        op.ttlSeconds,
      );
    }
  }
}
