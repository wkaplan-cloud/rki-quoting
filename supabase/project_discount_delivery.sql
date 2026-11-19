-- Discount and delivery on a quote/invoice (19 Nov 2026, asked by CKW, built for all studios).
-- discount_value is a % when discount_is_pct, otherwise a rand amount (excl. VAT).
-- Order: subtotal - discount = discounted subtotal; design fee % is worked out on that;
-- delivery is added after (no design fee on it); VAT on the lot.
alter table projects
  add column if not exists discount_value numeric not null default 0 check (discount_value >= 0),
  add column if not exists discount_is_pct boolean not null default true,
  add column if not exists delivery_fee numeric not null default 0 check (delivery_fee >= 0);
