import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create Products Read Model Table - First Time Migration
 *
 * Creates the products table for read model projections from ProductAggregate.
 * This migration aligns with the EventStoreDB-first architecture where:
 * - EventStoreDB is the source of truth for events
 * - PostgreSQL serves as read model projections
 * - Schema matches ProductSnapshotProps interface
 *
 * @pattern EventStoreDB-first with read model projections
 * @layer Infrastructure - Database Schema
 */
export class CreateProductsTable1700000000000 implements MigrationInterface {
  name = 'CreateProductsTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create products read model table
    await queryRunner.query(`
      CREATE TABLE products (
        code VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        currency_code VARCHAR(10) NOT NULL,
        channel_codes JSONB NOT NULL DEFAULT '[]',
        rail_codes JSONB NOT NULL DEFAULT '[]',
        category VARCHAR(50) NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        fees JSONB NOT NULL DEFAULT '{}',
        routing_number VARCHAR(20),
        account_number_prefix VARCHAR(20) NOT NULL,
        interest JSONB NOT NULL DEFAULT '{}',
        statement_code JSONB NOT NULL DEFAULT '{}',
        dormancy JSONB NOT NULL DEFAULT '{}',
        limits JSONB NOT NULL DEFAULT '{}',
        attributes JSONB,
        tenant_id VARCHAR(100) NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by VARCHAR(100),
        updated_by VARCHAR(100)
      );
    `);

    // Create performance indexes for query patterns
    await queryRunner.query(`
      CREATE INDEX idx_products_tenant_id 
      ON products(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_products_active 
      ON products(active);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_products_category 
      ON products(category);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_products_tenant_active 
      ON products(tenant_id, active);
    `);

    // Unique constraint for tenant isolation (business rule enforcement)
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_products_tenant_code 
      ON products(tenant_id, code);
    `);

    // Add comments for documentation
    await queryRunner.query(`
      COMMENT ON TABLE products IS 'Read model projection table for Product aggregates from EventStoreDB';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN products.code IS 'Primary business identifier for the product';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN products.tenant_id IS 'Tenant isolation identifier';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN products.version IS 'Version number for optimistic locking and change tracking';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_products_tenant_code
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_products_tenant_active
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_products_category
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_products_active
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_products_tenant_id
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS products`);
  }
}
