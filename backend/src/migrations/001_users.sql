CREATE TABLE IF NOT EXISTS local_users (
  id VARCHAR(255) PRIMARY KEY,
  oidc_issuer VARCHAR(512) NOT NULL,
  oidc_subject VARCHAR(512) NOT NULL,
  name VARCHAR(255) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  local_name VARCHAR(255) DEFAULT '',
  display_name VARCHAR(255) DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  timezone VARCHAR(64) DEFAULT '',
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_local_users_oidc UNIQUE (oidc_issuer, oidc_subject)
);
CREATE INDEX IF NOT EXISTS idx_local_users_admin ON local_users(is_admin);