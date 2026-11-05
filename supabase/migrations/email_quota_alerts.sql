-- Which daily Resend quota alerts have gone out (5 Nov 2026), so each is sent once a day.
create table if not exists email_quota_alerts (
  day   date not null,
  level int  not null,
  primary key (day, level)
);
alter table email_quota_alerts enable row level security;
