CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  contact VARCHAR(255) DEFAULT '',
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programs (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  department_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_curriculum_version_id VARCHAR(255),
  contact VARCHAR(255) DEFAULT '',
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS degrees (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  program_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact VARCHAR(255) DEFAULT '',
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lecturers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) REFERENCES local_users(id) ON DELETE SET NULL,
  department_id VARCHAR(255) REFERENCES departments(id) ON DELETE SET NULL,
  contact VARCHAR(255) DEFAULT '',
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  campus VARCHAR(255) DEFAULT '',
  building VARCHAR(255) DEFAULT '',
  address TEXT DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  room_type VARCHAR(255) DEFAULT '',
  owner VARCHAR(255) DEFAULT '',
  location_id VARCHAR(255) REFERENCES locations(id) ON DELETE SET NULL,
  floor VARCHAR(64) DEFAULT '',
  room_number VARCHAR(64) DEFAULT '',
  capacity INTEGER,
  layout JSONB,
  equipment JSONB,
  connectivity JSONB,
  accessibility JSONB,
  maintenance JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semesters (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) DEFAULT '',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taxonomy_items (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competency_matrices (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matrix_competencies (
  id VARCHAR(255) PRIMARY KEY,
  competency_matrix_id VARCHAR(255) NOT NULL REFERENCES competency_matrices(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255) DEFAULT '',
  description TEXT DEFAULT '',
  level VARCHAR(64) DEFAULT '',
  matrix_axis VARCHAR(1) NOT NULL CHECK (matrix_axis IN ('x', 'y')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competencies (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255) DEFAULT '',
  topic VARCHAR(255) DEFAULT '',
  description TEXT DEFAULT '',
  level VARCHAR(64) DEFAULT '',
  x_matrix_competency_id VARCHAR(255) REFERENCES matrix_competencies(id) ON DELETE SET NULL,
  y_matrix_competency_id VARCHAR(255) REFERENCES matrix_competencies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proofs_of_competency (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  answer_formats JSONB NOT NULL DEFAULT '[]'::jsonb,
  assignment_scope VARCHAR(255) DEFAULT '',
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curriculum_versions (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  version_number INTEGER NOT NULL DEFAULT 1,
  program_id VARCHAR(255) REFERENCES programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) DEFAULT '',
  description TEXT DEFAULT '',
  curriculum_version_id VARCHAR(255) REFERENCES curriculum_versions(id) ON DELETE CASCADE,
  degree_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  competency_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  proof_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  credit_points INTEGER,
  contact_hours INTEGER,
  contact VARCHAR(255) DEFAULT '',
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lessons (
  id VARCHAR(255) PRIMARY KEY,
  module_id VARCHAR(255) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  taxonomy_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  proof_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_entities (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) DEFAULT '',
  description TEXT DEFAULT '',
  semester_id VARCHAR(255) REFERENCES semesters(id) ON DELETE SET NULL,
  curriculum_version_id VARCHAR(255) REFERENCES curriculum_versions(id) ON DELETE SET NULL,
  degree_id VARCHAR(255) REFERENCES degrees(id) ON DELETE SET NULL,
  module_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  size INTEGER,
  contact VARCHAR(255) DEFAULT '',
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weeks (
  id VARCHAR(255) PRIMARY KEY,
  semester_id VARCHAR(255) NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  semester_week INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  days_off JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduling_rules (
  id VARCHAR(255) PRIMARY KEY,
  rule_type VARCHAR(255) NOT NULL,
  category VARCHAR(255) DEFAULT '',
  weight DOUBLE PRECISION DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT DEFAULT '',
  semester_id VARCHAR(255) REFERENCES semesters(id) ON DELETE CASCADE,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  applies_to JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);