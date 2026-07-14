-- Quick jobs: same pipeline as a normal project (quote → approval → done),
-- just flagged so they can be identified and filtered in the Projects list.
alter table elec_quotes add column if not exists is_quick_job boolean not null default false;
