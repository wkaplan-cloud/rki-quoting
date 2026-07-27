-- Speeds up project-detail page load (and RLS checks generally).
-- clients/suppliers/items/projects are RLS-scoped by org_id, line_items/project_stages/
-- email_logs/quote_approvals are scoped by project_id — none of these had an index,
-- so every read was a full table scan. CONCURRENTLY avoids locking writes while building.
--
-- Run each line separately in the Supabase SQL editor (CONCURRENTLY cannot run inside
-- a multi-statement transaction block).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_org_id ON clients(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_org_id ON suppliers(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_org_id ON items(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_org_id ON projects(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_line_items_project_id ON line_items(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_stages_project_id ON project_stages(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_project_id ON email_logs(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_approvals_project_id ON quote_approvals(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_org_id_status ON org_members(org_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
