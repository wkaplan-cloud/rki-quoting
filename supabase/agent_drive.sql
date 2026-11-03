-- Studio assistant: save filed PDFs to the studio's Google Drive.
--
-- The studio shares one folder (in a Shared Drive) with the assistant's
-- service account. The assistant keeps a subfolder per project inside it,
-- found by a project-id tag on the folder in Drive itself, so no folder list
-- is stored here.

alter table agent_mailboxes add column if not exists drive_folder_id text;

alter table agent_documents
  add column if not exists drive_file_id text,
  add column if not exists drive_parent_id text,
  add column if not exists drive_link text,
  add column if not exists drive_error text;

comment on column agent_documents.drive_error is
  'Why the file is not in Drive (not shared, quota, …). Null once it is there.';
