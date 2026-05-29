-- One-time fix: projects pushed to Sage before the auto-status-update was added.
-- Sets final_invoice_sent = true on project_stages and status = 'Invoice' on projects
-- for any project with a sage_invoice_id that hasn't been updated yet.

-- Step 1: mark final_invoice_sent on project_stages for all sage-pushed projects
INSERT INTO project_stages (project_id, final_invoice_sent, final_invoice_sent_at)
SELECT
  p.id,
  true,
  COALESCE(p.sage_pushed_at, NOW())
FROM projects p
LEFT JOIN project_stages ps ON ps.project_id = p.id
WHERE p.sage_invoice_id IS NOT NULL
  AND p.archived_at IS NULL
  AND (ps.final_invoice_sent IS NULL OR ps.final_invoice_sent = false)
  AND (ps.final_invoice_paid IS NULL OR ps.final_invoice_paid = false)
ON CONFLICT (project_id) DO UPDATE
  SET final_invoice_sent      = true,
      final_invoice_sent_at   = COALESCE(project_stages.final_invoice_sent_at, EXCLUDED.final_invoice_sent_at);

-- Step 2: advance project status to 'Invoice' where it's still behind
-- Excludes: already Invoice, Cancelled, Completed, and projects where the final invoice is already paid
UPDATE projects
SET status = 'Invoice'
WHERE sage_invoice_id IS NOT NULL
  AND archived_at IS NULL
  AND status NOT IN ('Invoice', 'Cancelled', 'Completed')
  AND NOT EXISTS (
    SELECT 1 FROM project_stages ps
    WHERE ps.project_id = projects.id
      AND ps.final_invoice_paid = true
  );
