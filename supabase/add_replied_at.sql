alter table contact_submissions
  add column if not exists replied_at timestamptz;
