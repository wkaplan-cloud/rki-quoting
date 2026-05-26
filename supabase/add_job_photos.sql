-- Add share_token to elec_jobs for worker-facing job links
alter table elec_jobs
  add column if not exists share_token uuid unique default null,
  add column if not exists share_token_created_at timestamptz default null;

create index if not exists idx_elec_jobs_share_token on elec_jobs(share_token);

-- Job photos table
create table if not exists elec_job_photos (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references elec_jobs(id) on delete cascade,
  portal_account_id uuid not null references supplier_portal_accounts(id) on delete cascade,
  storage_path      text not null,
  public_url        text not null,
  file_name         text,
  uploaded_by_name  text,
  created_at        timestamptz default now()
);

create index if not exists idx_elec_job_photos_job on elec_job_photos(job_id);

-- Storage bucket (run this if the bucket doesn't exist yet)
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

-- Allow public read of job photos
create policy if not exists "Public read job photos"
  on storage.objects for select
  using (bucket_id = 'job-photos');

-- Allow service role to insert (our API handles auth)
create policy if not exists "Service role insert job photos"
  on storage.objects for insert
  with check (bucket_id = 'job-photos');
