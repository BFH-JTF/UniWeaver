ALTER TABLE semesters ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS slot_start_times JSONB NOT NULL DEFAULT '[]'::jsonb;