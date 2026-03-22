-- Add project stages tracking table
create table if not exists project_stages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null unique,
  quote_sent boolean default false,
  quote_sent_at timestamptz,
  deposit_received boolean default false,
  deposit_received_at timestamptz,
  pos_sent boolean default false,
  pos_sent_at timestamptz,
  items_received boolean default false,
  items_received_at timestamptz,
  fabrics_sent boolean default false,
  fabrics_sent_at timestamptz,
  final_invoice_sent boolean default false,
  final_invoice_sent_at timestamptz,
  delivered_installed boolean default false,
  delivered_installed_at timestamptz,
  created_at timestamptz default now()
);

alter table project_stages enable row level security;
create policy "Users manage stages via project" on project_stages
  using (
    exists (
      select 1 from projects p where p.id = project_stages.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from projects p where p.id = project_stages.project_id and p.user_id = auth.uid()
    )
  );
