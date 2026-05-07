-- Change default deposit percentage from 70% to 50% for new agencies.
-- Existing studios already have their value stored — this only affects new sign-ups.
alter table settings
  alter column deposit_percentage set default 50;

alter table settings
  alter column footer_text set default 'Thank you for your business. All prices quoted are valid for 30 days. A 50% deposit is required to confirm your order.';
