-- Studio: who created a board, and when
-- Run this in Supabase SQL Editor.
--
-- A board is filed under a client at the moment it is inserted and nothing
-- has ever recorded who did the filing. When a board turned up under the
-- wrong client there was no way to answer "who made this?" from the data —
-- studio_slides.last_edited_by only names the most recent editor of a slide,
-- which is a different question and often a different person.
--
-- This is deliberately NOT the board-level author column that
-- studio_attribution.sql argued against. That one would have to be rewritten
-- on every 800ms autosave and would make studio_boards.updated_at pretend to
-- be evidence of work. This is written exactly once, inside the insert that
-- creates the board, and never touched again.
--
-- The name is snapshotted alongside the id for the same reason as everywhere
-- else in Studio: it survives the person leaving the org, and it keeps the
-- boards list free of a join per row.

alter table studio_boards
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_by_name text;

-- Backfill: intentionally none. The three boards that pre-date this column
-- have no creator on record and inventing one would be a guess. They read as
-- "—" and stay that way.
