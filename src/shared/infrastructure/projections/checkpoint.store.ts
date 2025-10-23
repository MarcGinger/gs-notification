import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Log, componentLogger, Logger } from '../../logging';

const APP_LOGGER = 'APP_LOGGER';

const COMPONENT = 'RedisCheckpointStore';

/**
 * Full ESDB position with both commit and prepare bigints
 */
export interface CheckpointPosition {
  commit: string; // bigint serialized as string
  prepare: string; // bigint serialized as string
  updatedAt?: string; // ISO timestamp
}

/**
 * Enhanced checkpoint store interface with production features
 */
export interface CheckpointStore {
  get(key: string): Promise<CheckpointPosition | null>;
  set(key: string, pos: CheckpointPosition, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  // Admin helpers with SCAN-based pagination
  scan(prefix?: string, pageSize?: number): Promise<string[]>;
  getAll(
    prefix?: string,
    pageSize?: number,
  ): Promise<Record<string, CheckpointPosition>>;
  clear(prefix?: string, pageSize?: number): Promise<number>;

  // Optional: Compare-and-set for concurrent writers
  setIfNewer(
    key: string,
    pos: CheckpointPosition,
    ttlSeconds?: number,
  ): Promise<boolean>;
}
