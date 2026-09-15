-- Did the supplier actually open their pricing link?
--
-- Deliberately NOT an email open pixel. Apple Mail Privacy Protection
-- pre-fetches every image the moment mail is delivered and Gmail proxies them,
-- so a pixel reports opens nobody made — and anyone with images blocked never
-- reports one they did. Both directions wrong.
--
-- These are stamped by a POST from the pricing page after it mounts in a real
-- browser. Mail-security scanners (Defender Safe Links, Mimecast, Barracuda)
-- fetch link targets to check them, but do not execute JavaScript, so they do
-- not register here. See src/app/api/rfq/[token]/opened/route.ts.
--
-- Run manually in the Supabase SQL Editor.

-- First open. Never overwritten — "when did they first look" is the question
-- the Procurement panel answers.
alter table rfq_requests add column if not exists opened_at timestamptz;
-- Most recent open, and how many times in total. A single hit that never
-- repeats reads very differently from a supplier coming back to the form.
alter table rfq_requests add column if not exists last_opened_at timestamptz;
alter table rfq_requests add column if not exists open_count integer not null default 0;
