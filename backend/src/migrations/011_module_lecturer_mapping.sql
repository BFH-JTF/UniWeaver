-- Module <-> Lecturer mapping (target model: MODULE }o--o{ LECTURER : "taught by")
CREATE TABLE IF NOT EXISTS module_lecturers (
  lecturer_id VARCHAR(255) NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
  module_id VARCHAR(255) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (lecturer_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_module_lecturers_module ON module_lecturers(module_id);
CREATE INDEX IF NOT EXISTS idx_module_lecturers_lecturer ON module_lecturers(lecturer_id);