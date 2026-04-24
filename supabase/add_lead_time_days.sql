-- Add lead_time_days to line_items for sub-week lead times (e.g. in-stock = 2 days)
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS lead_time_days integer;
