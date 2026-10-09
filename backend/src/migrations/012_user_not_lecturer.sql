-- Self-service opt-out: by default every active user counts as a lecturer.
-- Users may exclude themselves from lecturer lists via this flag; user admins
-- and global admins can set it on any account.
ALTER TABLE local_users ADD COLUMN IF NOT EXISTS is_not_lecturer BOOLEAN NOT NULL DEFAULT FALSE;