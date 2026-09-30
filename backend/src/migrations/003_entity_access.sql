-- Per-object access control: grants a role to a user on one entity row.
-- Role hierarchy: admin > write > read (admin implies write implies read).
CREATE TABLE IF NOT EXISTS entity_access (
  table_name VARCHAR(64) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL CHECK (role IN ('read', 'write', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (table_name, entity_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_access_entity ON entity_access(table_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_access_user ON entity_access(user_id);

-- Lossless key/value bag for unmapped payload fields on curriculum tables
-- (historical camelCase aliases and future extensions live here).
ALTER TABLE departments ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE degrees ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE class_entities ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;