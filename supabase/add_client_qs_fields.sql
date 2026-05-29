alter table elec_clients
  add column if not exists qs_name  text,
  add column if not exists qs_email text;
