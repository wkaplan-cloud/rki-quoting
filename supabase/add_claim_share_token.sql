-- Add share_token to elec_claims for client-facing claim view links
alter table elec_claims
  add column if not exists share_token uuid unique default null,
  add column if not exists share_token_created_at timestamptz default null;

create index if not exists idx_elec_claims_share_token on elec_claims(share_token);
