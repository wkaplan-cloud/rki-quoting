-- Rename items_received to fabrics_received
alter table project_stages rename column items_received to fabrics_received;
alter table project_stages rename column items_received_at to fabrics_received_at;

-- Add final invoice paid stage
alter table project_stages add column if not exists final_invoice_paid boolean default false;
alter table project_stages add column if not exists final_invoice_paid_at timestamptz;
