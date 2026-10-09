CREATE TABLE IF NOT EXISTS curriculums (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  active_version_id VARCHAR(255) REFERENCES curriculum_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- curriculums is an `audited` table and needs the lossless extra bag.
ALTER TABLE curriculums ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE curriculum_versions ADD COLUMN IF NOT EXISTS curriculum_id VARCHAR(255) REFERENCES curriculums(id) ON DELETE CASCADE;

ALTER TABLE programs DROP COLUMN IF EXISTS active_curriculum_version_id;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS curriculum_id VARCHAR(255) REFERENCES curriculums(id) ON DELETE SET NULL;
