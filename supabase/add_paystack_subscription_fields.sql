-- Paystack subscription tracking fields on organizations
alter table organizations
  add column if not exists paystack_reference text,
  add column if not exists paystack_pending_plan text;
