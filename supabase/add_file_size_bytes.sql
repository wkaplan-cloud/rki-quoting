-- Add file size tracking to sourcing request images
ALTER TABLE sourcing_request_images
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER;
