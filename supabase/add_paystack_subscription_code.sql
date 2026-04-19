-- Paystack recurring subscription tracking
alter table organizations
  add column if not exists paystack_subscription_code text,
  add column if not exists paystack_customer_code text;
