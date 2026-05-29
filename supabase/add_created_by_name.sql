-- Track who created each quote and job card (denormalized name, set at insert time)
ALTER TABLE elec_quotes    ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE elec_job_cards ADD COLUMN IF NOT EXISTS created_by_name text;
