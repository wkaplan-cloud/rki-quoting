-- Staff members for the electrician's team
-- Used for job scheduling and timesheet tracking

create table if not exists elec_staff (
  id                uuid        primary key default uuid_generate_v4(),
  portal_account_id uuid        references supplier_portal_accounts(id) on delete cascade not null,
  name              text        not null,
  role              text        not null default 'electrician', -- 'electrician'|'apprentice'|'site_foreman'|'helper'|'admin'
  phone             text,
  email             text,
  color             text        not null default '#3A7CA5',     -- calendar display colour
  is_active         boolean     not null default true,
  created_at        timestamptz default now()
);

alter table elec_staff enable row level security;

create policy "Supplier owns elec_staff" on elec_staff
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_staff.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_staff.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );

create index if not exists idx_elec_staff_portal on elec_staff(portal_account_id);
