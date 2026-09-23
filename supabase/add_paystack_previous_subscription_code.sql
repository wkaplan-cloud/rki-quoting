-- Plan upgrades/downgrades: remember the subscription that is being replaced so
-- it can be cancelled AFTER the new payment succeeds.
--
-- The old flow disabled the live subscription the moment the customer opened the
-- Paystack checkout, so an abandoned upgrade left a paying customer with no
-- subscription at all (and the subscription.disable webhook then flipped their
-- org to 'cancelled', locking them out).

alter table organizations
  add column if not exists paystack_previous_subscription_code text;

comment on column organizations.paystack_previous_subscription_code is
  'Subscription code being replaced by an in-flight plan change; cancelled once the new payment succeeds, then cleared.';
