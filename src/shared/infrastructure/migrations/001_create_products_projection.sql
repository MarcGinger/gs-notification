-- Product Projector Database Schema
-- Based on IMPLEMENTATION.md specification
-- Creates the products table and required indexes for the Product Projector

BEGIN;

-- Create the products projection table
CREATE TABLE IF NOT EXISTS products (
  tenant_id              text        NOT NULL,
  code                   text        NOT NULL,

  name                   text        NOT NULL,
  description            text,
  active                 boolean     NOT NULL,
  currency_code          text        NOT NULL,
  channel_codes          jsonb,            -- array of string
  rail_codes             jsonb,            -- array of number mapped to string
  category               text        NOT NULL,
  is_default             boolean     NOT NULL DEFAULT false,
  fees                   jsonb,
  routing_number         text,
  account_number_prefix  text        NOT NULL,
  interest               jsonb,
  statement              jsonb,
  dormancy               jsonb,
  limits                 jsonb,
  attributes             jsonb,

  version                integer     NOT NULL,
  created_at             timestamptz NOT NULL,
  updated_at             timestamptz NOT NULL,
  deleted_at             timestamptz,

  -- Idempotency guard (optional, if you also want to assert revision ordering beyond version)
  last_stream_revision   bigint,

  PRIMARY KEY (tenant_id, code)
);

-- Create indexes for common query patterns

-- Point lookups & consistency checks
CREATE INDEX IF NOT EXISTS idx_products_tenant_code ON products (tenant_id, code);

-- Common filters
CREATE INDEX IF NOT EXISTS idx_products_tenant_active   ON products (tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_category ON products (tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_products_updated_desc    ON products (tenant_id, updated_at DESC);

-- JSONB search indexes
CREATE INDEX IF NOT EXISTS idx_products_channel_codes_gin ON products USING GIN (channel_codes);
CREATE INDEX IF NOT EXISTS idx_products_rail_codes_gin    ON products USING GIN (rail_codes);
CREATE INDEX IF NOT EXISTS idx_products_attributes_gin    ON products USING GIN (attributes);

-- Index for soft delete filtering
CREATE INDEX IF NOT EXISTS idx_products_tenant_active_not_deleted ON products (tenant_id, active) WHERE deleted_at IS NULL;

-- Version-based queries for optimistic concurrency
CREATE INDEX IF NOT EXISTS idx_products_tenant_version ON products (tenant_id, code, version);

-- Create the projector checkpoints table
CREATE TABLE IF NOT EXISTS projector_checkpoints (
  projector_name  text PRIMARY KEY,
  position_commit bigint NOT NULL,
  position_prepare bigint NOT NULL,
  updated_at timestamptz NOT NULL
);

-- Index for checkpoint queries
CREATE INDEX IF NOT EXISTS idx_projector_checkpoints_updated ON projector_checkpoints (updated_at DESC);

-- Add comments for documentation
COMMENT ON TABLE products IS 'Product projection table - materialized view from EventStoreDB Product events';
COMMENT ON COLUMN products.tenant_id IS 'Multi-tenant isolation key - extracted from event metadata';
COMMENT ON COLUMN products.code IS 'Product unique identifier within tenant';
COMMENT ON COLUMN products.version IS 'Aggregate version for optimistic concurrency and monotonic ordering';
COMMENT ON COLUMN products.deleted_at IS 'Soft delete timestamp - NULL means active product';
COMMENT ON COLUMN products.last_stream_revision IS 'EventStore stream revision for idempotency guard';

COMMENT ON TABLE projector_checkpoints IS 'Projection checkpoint tracking for reliable recovery';
COMMENT ON COLUMN projector_checkpoints.position_commit IS 'EventStore commit position';
COMMENT ON COLUMN projector_checkpoints.position_prepare IS 'EventStore prepare position';

-- Create a view for active products (commonly used)
CREATE OR REPLACE VIEW active_products AS
SELECT 
  tenant_id,
  code,
  name,
  description,
  currency_code,
  channel_codes,
  rail_codes,
  category,
  is_default,
  fees,
  routing_number,
  account_number_prefix,
  interest,
  statement,
  dormancy,
  limits,
  attributes,
  version,
  created_at,
  updated_at
FROM products 
WHERE deleted_at IS NULL AND active = true;

COMMENT ON VIEW active_products IS 'View of active (non-deleted and enabled) products';

COMMIT;