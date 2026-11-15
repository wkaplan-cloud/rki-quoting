-- "Ask Mia": studio admins ask questions about their own business on the
-- assistant page. Per-org platform switch, off by default.
alter table settings add column if not exists ask_mia_enabled boolean not null default false;
