-- Allow COC to be linked to a job card (in addition to / instead of a quote)
ALTER TABLE elec_coc ALTER COLUMN quote_id DROP NOT NULL;
ALTER TABLE elec_coc ADD COLUMN IF NOT EXISTS job_card_id UUID REFERENCES elec_job_cards(id) ON DELETE CASCADE;
ALTER TABLE elec_coc ADD COLUMN IF NOT EXISTS portal_account_id UUID REFERENCES supplier_portal_accounts(id) ON DELETE CASCADE;

-- Backfill portal_account_id from the linked quote for existing rows
UPDATE elec_coc c
SET portal_account_id = q.portal_account_id
FROM elec_quotes q
WHERE c.quote_id = q.id AND c.portal_account_id IS NULL;

-- RLS: allow access if linked to a quote owned by the account, OR directly by job card, OR by portal_account_id
DROP POLICY IF EXISTS "elec_coc_policy" ON elec_coc;
CREATE POLICY "elec_coc_policy" ON elec_coc
  USING (
    portal_account_id IN (
      SELECT id FROM supplier_portal_accounts WHERE auth_user_id = auth.uid()
    )
    OR quote_id IN (
      SELECT id FROM elec_quotes WHERE portal_account_id IN (
        SELECT id FROM supplier_portal_accounts WHERE auth_user_id = auth.uid()
      )
    )
    OR job_card_id IN (
      SELECT id FROM elec_job_cards WHERE portal_account_id IN (
        SELECT id FROM supplier_portal_accounts WHERE auth_user_id = auth.uid()
      )
    )
  );
