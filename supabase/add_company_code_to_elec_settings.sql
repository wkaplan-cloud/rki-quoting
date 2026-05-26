-- Add explicit company_code field to elec_settings
-- Previously the code was auto-derived from supplier_portal_accounts.company_name,
-- which silently dropped the prefix if company_name was null.
alter table elec_settings
  add column if not exists company_code text;
