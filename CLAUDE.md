@AGENTS.md

# QuotingHub — Data Scoping Rules

## Org-scoped vs user-scoped tables

This app is multi-tenant. Every org has isolated data. These tables are **org-scoped** — always filter by `org_id`, never `user_id`:

- `settings`, `projects`, `clients`, `suppliers`, `items`, `line_items`
- `price_lists`, `price_list_items`, `price_list_access`
- `sourcing_sessions`, `sourcing_session_items`, `sourcing_session_suppliers`
- `audit_logs`, `org_notifications`, `quote_approvals`, `quote_approval_logs`
- `project_stages`, `email_logs`

These tables are **user-scoped** (correct to filter by `user_id`):

- `org_members` — links users to orgs
- `elec_staff` — individual field workers
- Auth lookups (`auth.admin.getUserById`, etc.)

## supabaseAdmin warning

`supabaseAdmin` bypasses RLS entirely. Any read through `supabaseAdmin` **must** include an explicit `.eq('org_id', ...)` or `.in('org_id', [...])` filter on org-scoped tables — otherwise it reads across all orgs and leaks data.

The RLS-filtered `supabase` client (from `createClient()`) is safe to use without explicit org filters inside authenticated routes — RLS handles scoping automatically.

## How to catch regressions

Run before any deploy:
```bash
grep -rn "\.eq('user_id'" src/app/api src/app/platform --include="*.ts" --include="*.tsx"
```
Any match on an org-scoped table (settings, projects, clients, suppliers, items, price_lists) is a bug.
