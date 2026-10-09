-- Delegated role flags alongside is_admin:
--   is_admin      = global admin (superuser); implicitly also user admin and scheduler
--   is_user_admin = may manage user accounts, but cannot grant roles
--   is_scheduler  = may work in the Scheduling tool (mapping, rooms, availability)
ALTER TABLE local_users ADD COLUMN IF NOT EXISTS is_user_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE local_users ADD COLUMN IF NOT EXISTS is_scheduler BOOLEAN NOT NULL DEFAULT FALSE;