-- Scheduling restrictions attachable to any curriculum entity. A restriction
-- on an entity applies to everything it contains (downward inheritance along
-- program.departmentIds, degree.programIds, module.degreeIds and
-- class_entities.degree_id), so a department restriction reaches every module
-- and class beneath it. A session only has to satisfy one restriction per
-- ancestor chain node that it reaches through multiple parents (OR within
-- parallel parents), but must satisfy both its module tree and its class tree
-- (AND across the two trees).
CREATE TABLE IF NOT EXISTS entity_restrictions (
  id VARCHAR(255) PRIMARY KEY,
  table_name VARCHAR(64) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  rule_type VARCHAR(64) NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weight DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entity_restrictions_entity ON entity_restrictions(table_name, entity_id);