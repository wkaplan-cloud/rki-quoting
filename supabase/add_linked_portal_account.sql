-- Allow a portal account to be linked to another, so both contacts see the same requests.
ALTER TABLE supplier_portal_accounts
ADD COLUMN IF NOT EXISTS linked_portal_account_id uuid REFERENCES supplier_portal_accounts(id) ON DELETE SET NULL;
