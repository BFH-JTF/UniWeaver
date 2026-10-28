-- Modules can be taught in multiple installments per semester (e.g. weekly
-- occurrences). One installment lasts module.timeslots semester slots; NULL
-- or <= 0 means a single installment.
ALTER TABLE modules ADD COLUMN IF NOT EXISTS installments INTEGER;