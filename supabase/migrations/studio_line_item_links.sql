-- Studio → quote breadcrumbs. Run in Supabase SQL Editor.
--
-- Every line item created by board conversion remembers exactly where it
-- came from: the slide, and (for item rows) the canvas object. Hidden from
-- users — exists so a future feature can jump from a quote line straight
-- back to its object in Studio.
--
-- No FKs on purpose: objects live inside studio_slides.objects JSONB, and
-- boards/slides may be deleted after conversion — the quote must not care.
alter table line_items add column if not exists studio_object_id uuid;
alter table line_items add column if not exists studio_slide_id uuid;
