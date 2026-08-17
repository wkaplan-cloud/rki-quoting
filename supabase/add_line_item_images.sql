-- Per-line-item images (designer portal)
--
-- line_items.image_urls  — designer-uploaded images, ordered. First one is the
--                          image that renders on the quote / invoice PDF.
--                          fabric_image_url stays as-is: it is the automatic
--                          catalogue image (Twinbru / price list / Studio) and
--                          is used as a fallback when image_urls is empty.
--
-- Two flags, same shape as studio_enabled / capital_hotels_enabled:
--
-- settings.line_item_images_enabled  — PLATFORM flag. Off for everyone; turned
--                          on per studio from /platform/studios/[id]. The studio
--                          cannot change this themselves.
--
-- settings.show_images_on_documents  — the studio's own preference, once granted
--                          access. Defaults ON so flipping the platform flag is
--                          enough to make images appear; a designer who wants
--                          images in the app but not on client PDFs can opt out.

alter table line_items
  add column if not exists image_urls text[] default '{}';

alter table settings
  add column if not exists line_item_images_enabled boolean not null default false;

alter table settings
  add column if not exists show_images_on_documents boolean not null default true;

-- Images are stored in the existing public "sourcing-images" bucket under
-- line-items/<user_id>/<line_item_id>/<file>. No new bucket required.

-- To grant a studio access:
--   UPDATE settings SET line_item_images_enabled = true WHERE org_id = '<org-id>';
-- or use the Feature Toggles panel at /platform/studios/<org-id>.
