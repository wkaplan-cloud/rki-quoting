-- Studio: boards belong to CLIENTS, not projects
-- (the moodboard comes first — the project/quote is created later)
-- Run this in Supabase SQL Editor AFTER studio.sql

-- 1. Add client link
alter table studio_boards add column if not exists client_id uuid references clients(id) on delete cascade;

-- 2. Backfill any existing boards from their project's client
update studio_boards b
set client_id = p.client_id
from projects p
where b.project_id = p.id and b.client_id is null;

-- 3. Boards that still have no client (project without a client) are early test data
delete from studio_boards where client_id is null;

alter table studio_boards alter column client_id set not null;

-- 4. Project link becomes optional — kept for the future quote/procurement sprints
alter table studio_boards alter column project_id drop not null;

-- 5. A client can have many boards
drop index if exists studio_boards_project_uniq;
create index if not exists studio_boards_client_idx on studio_boards(client_id);
