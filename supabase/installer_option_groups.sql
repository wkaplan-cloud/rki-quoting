-- Good / better / best (2026-09-24)
--
-- A section can be one of several alternatives the client chooses between —
-- "Cinema: 5.1 package" vs "7.1 package" vs "9.2 package". Sections sharing
-- an option_group are the alternatives; option_chosen marks the one the
-- total is built on (the contractor's recommendation until the client picks).
-- On acceptance the unchosen alternatives are deleted and the chosen one
-- becomes an ordinary section, so claims never see alternatives.
alter table elec_quote_sections
  add column if not exists option_group text,
  add column if not exists option_chosen boolean not null default false;
