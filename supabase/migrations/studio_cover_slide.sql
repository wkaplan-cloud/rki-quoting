-- Studio: cover slide flag. Run in Supabase SQL Editor.
--
-- Marks a slide as the board's title/cover slide (large centered logo,
-- client name, project detail — composed as ordinary objects). The editor
-- skips the standard master layout (heading/title/page number/corner logo)
-- on this one slide so the two don't visually clash.
alter table studio_slides add column if not exists is_cover boolean not null default false;
