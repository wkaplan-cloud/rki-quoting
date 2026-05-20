alter table projects
  add column if not exists sage_customer_id text null,
  add column if not exists sage_customer_name text null;
