-- Studio attribution: who edited what, and when
-- Run this in Supabase SQL Editor.
--
-- Studio was the one module with no author trail: boards, slides and specs
-- recorded `updated_at` but never a user, so "what did <designer> do
-- yesterday?" was unanswerable for any moodboard work.
--
-- Nothing here adds a write. The autosave already upserts these rows and
-- already inserts a throttled revision snapshot — these columns ride along in
-- the payloads that are being sent anyway.
--
-- The name is stored alongside the id on purpose. It is a snapshot of who the
-- person was at the time of the edit, it survives them leaving the org, and it
-- keeps the boards list and the activity feed free of a join per row.

-- 1. Current author on the live rows ─────────────────────────────────────────
alter table studio_slides
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by_name text;

alter table studio_specs
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by_name text;

-- No board-level author column, on purpose. Two reasons:
--   1. studio_boards.updated_at already moves when someone merely opens a
--      board and pans around — the zoom/pan state save writes it — so the
--      board row is not evidence of work and should not pretend to be.
--   2. Writing one would mean an extra round-trip on every 800ms autosave.
-- The boards list derives its author from the most recently edited slide
-- instead: one grouped read on a page that loads once.

-- 2. Author on every history snapshot ────────────────────────────────────────
--    This is what the activity feed reads: one row per slide per 5 minutes of
--    active editing, pruned at 30 days by the studio-storage-cleanup cron.
alter table studio_slide_revisions
  add column if not exists edited_by uuid references auth.users(id) on delete set null,
  add column if not exists edited_by_name text;

-- Feeds "who worked on what, when" across the whole org for a date range.
create index if not exists studio_slide_revisions_org_created_idx
  on studio_slide_revisions(org_id, created_at desc);

-- Feeds the per-person filter.
create index if not exists studio_slide_revisions_editor_idx
  on studio_slide_revisions(edited_by, created_at desc);

-- 3. Backfill ────────────────────────────────────────────────────────────────
-- Intentionally none. Existing rows have no author on record and inventing one
-- would be a guess; they read as "—" until the next edit stamps them.
