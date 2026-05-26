-- Scheduled jobs — links a quote to a date, time, and staff member
-- Powers the week-view scheduling calendar

create table if not exists elec_jobs (
  id                uuid        primary key default uuid_generate_v4(),
  portal_account_id uuid        references supplier_portal_accounts(id) on delete cascade not null,
  quote_id          uuid        references elec_quotes(id) on delete set null,
  staff_id          uuid        references elec_staff(id) on delete set null,
  title             text        not null,
  address           text,
  notes             text,
  scheduled_date    date        not null,
  start_time        time        not null default '08:00',
  end_time          time        not null default '17:00',
  status            text        not null default 'scheduled',
  -- status: 'scheduled'|'in_progress'|'completed'|'cancelled'
  created_at        timestamptz default now()
);

alter table elec_jobs enable row level security;

create policy "Supplier owns elec_jobs" on elec_jobs
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_jobs.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_jobs.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );

create index if not exists idx_elec_jobs_portal on elec_jobs(portal_account_id);
create index if not exists idx_elec_jobs_date   on elec_jobs(scheduled_date);
create index if not exists idx_elec_jobs_staff  on elec_jobs(staff_id);
create index if not exists idx_elec_jobs_quote  on elec_jobs(quote_id);
