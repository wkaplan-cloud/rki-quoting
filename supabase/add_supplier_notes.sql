-- Add notes column to suppliers table
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS notes text;
