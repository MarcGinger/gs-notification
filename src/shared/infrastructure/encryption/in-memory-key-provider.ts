import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { KeyProvider } from './types';

/**
 * In-Memory Key Provider for Development/Testing
 *
 * Simple implementation of KeyProvider for development and testing.
 * In production, this should be replaced with a proper key management
 * system (AWS KMS, Azure Key Vault, HashiCorp Vault, etc.).
 *
 * Features:
 * - Tenant-isolated keys
 * - Key rotation support
 * - In-memory storage (not persistent)
 *
 * @pattern Key Management for Encryption
 * @layer Infrastructure - Key Management
 * @warning Not suitable for production use - keys are not persistent
 */
@Injectable()
export class InMemoryKeyProvider implements KeyProvider {
  private readonly keys = new Map<string, Buffer>();
  private readonly tenantActiveKeys = new Map<string, string>();

  constructor() {
    // Initialize with some default keys for testing
    this.initializeDefaultKeys();
  }

  /**
   * Get encryption key by ID
   */
  getKey(keyId: string): Promise<Buffer> {
    const key = this.keys.get(keyId);
    if (!key) {
      return Promise.reject(new Error(`Key not found: ${keyId}`));
    }
    return Promise.resolve(key);
  }

  /**
   * Get the currently active key for new encryption operations
   */
  async getActiveKey(): Promise<{ id: string; key: Buffer }> {
    // For simplicity, use a default active key
    // In production, this would be tenant-specific
    const keyId = 'default-key-2024-v1';
    const key = await this.getKey(keyId);
    return { id: keyId, key };
  }

  /**
   * Check if a key exists and is valid
   */
  hasKey(keyId: string): Promise<boolean> {
    return Promise.resolve(this.keys.has(keyId));
  }

  /**
   * Add a new key (for testing/rotation)
   */
  addKey(keyId: string, key?: Buffer): void {
    const keyBuffer = key || crypto.randomBytes(32); // 256-bit key for AES-256
    this.keys.set(keyId, keyBuffer);
  }

  /**
   * Set active key for a tenant
   */
  setActiveKey(tenantId: string, keyId: string): void {
    if (!this.keys.has(keyId)) {
      throw new Error(`Cannot set active key: key ${keyId} does not exist`);
    }
    this.tenantActiveKeys.set(tenantId, keyId);
  }

  /**
   * Get active key for a specific tenant
   */
  async getActiveKeyForTenant(
    tenantId: string,
  ): Promise<{ id: string; key: Buffer }> {
    const activeKeyId =
      this.tenantActiveKeys.get(tenantId) || 'default-key-2024-v1';
    const key = await this.getKey(activeKeyId);
    return { id: activeKeyId, key };
  }

  /**
   * Initialize default keys for testing
   */
  private initializeDefaultKeys(): void {
    // Create some default keys for development/testing
    this.addKey('default-key-2024-v1', crypto.randomBytes(32));
    this.addKey('rotation-key-2024-v2', crypto.randomBytes(32));
    this.addKey('tenant-specific-key-v1', crypto.randomBytes(32));
  }

  /**
   * Rotate keys (create new active key)
   */
  rotateKey(tenantId?: string): string {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const keyId = `key-${timestamp}-${crypto.randomUUID().slice(0, 8)}`;

    this.addKey(keyId, crypto.randomBytes(32));

    if (tenantId) {
      this.setActiveKey(tenantId, keyId);
    }

    return keyId;
  }

  /**
   * Get all available key IDs (for debugging)
   */
  getAvailableKeys(): string[] {
    return Array.from(this.keys.keys());
  }
}
