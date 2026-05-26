-- Add share_token to elec_quotes for customer-facing quote approval portal

alter table elec_quotes
  add column if not exists share_token uuid unique default null,
  add column if not exists share_token_created_at timestamptz default null;

create index if not exists idx_elec_quotes_share_token on elec_quotes(share_token);
