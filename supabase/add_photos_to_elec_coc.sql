-- COC photos: array of { url, description } shown at the end of the certificate
alter table elec_coc add column if not exists photos jsonb not null default '[]'::jsonb;
