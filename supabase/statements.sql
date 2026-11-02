-- Payments + client statements (per-org feature, first built for Julie Peatling Interiors).
--
-- Each payment a client makes is a row in project_payments. The project's
-- existing `deposit_amount_received` — the "paid so far" figure every invoice
-- prints — is kept equal to the sum of those rows by a trigger, so invoices,
-- emails and the admin reports carry on reading the one field they always have.
--
-- Projects linked to a Sage invoice are left alone: Sage writes their paid
-- figure on sync, and the app refuses manual payments on them.
--
-- Off by default; switched on per studio from Platform → Studios → Feature
-- Toggles. Studios with the switch off see exactly what they did before.

alter table settings
  add column if not exists statements_enabled boolean not null default false;

comment on column settings.statements_enabled is
  'Platform toggle: record individual payments per project, and client statements (PDF + email).';

create table if not exists project_payments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  project_id  uuid not null references projects(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  paid_on     date not null,
  method      text,
  reference   text,
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create index if not exists project_payments_project_idx on project_payments (project_id);
create index if not exists project_payments_org_idx on project_payments (org_id);

alter table project_payments enable row level security;

drop policy if exists "Org members manage project payments" on project_payments;
create policy "Org members manage project payments" on project_payments
  for all
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- Keep the project's paid figure equal to its payments. Null when there are none,
-- matching how the old hand-typed box stored "nothing paid".
create or replace function sync_project_amount_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
begin
  update projects
     set deposit_amount_received = (select sum(amount) from project_payments where project_id = pid)
   where id = pid;
  return null;
end;
$$;

drop trigger if exists project_payments_sync_paid on project_payments;
create trigger project_payments_sync_paid
  after insert or update or delete on project_payments
  for each row execute function sync_project_amount_paid();

-- Run when a studio's switch is turned on: any amount already typed into the
-- old deposit box that the ledger doesn't account for becomes one payment,
-- dated when the deposit stage was ticked. Safe to run again — it only adds
-- the difference. Returns how many rows it added.
create or replace function open_payment_ledger(p_org_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  with paid as (
    select project_id, sum(amount) as total from project_payments group by project_id
  ), ins as (
    insert into project_payments (org_id, project_id, amount, paid_on, note)
    select p.org_id,
           p.id,
           p.deposit_amount_received - coalesce(paid.total, 0),
           coalesce((s.deposit_received_at at time zone 'Africa/Johannesburg')::date,
                    (p.created_at at time zone 'Africa/Johannesburg')::date),
           'Recorded before payment tracking'
      from projects p
      left join project_stages s on s.project_id = p.id
      left join paid on paid.project_id = p.id
     where p.org_id = p_org_id
       and p.sage_invoice_id is null
       and p.deposit_amount_received > coalesce(paid.total, 0)
    returning 1
  )
  select count(*)::int from ins;
$$;

revoke execute on function open_payment_ledger(uuid) from public, anon, authenticated;
