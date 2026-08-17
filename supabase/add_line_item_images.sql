-- Per-line-item images (designer portal)
--
-- line_items.image_urls  — designer-uploaded images, ordered. First one is the
--                          image that renders on the quote / invoice PDF.
--                          fabric_image_url stays as-is: it is the automatic
--                          catalogue image (Twinbru / price list / Studio) and
--                          is used as a fallback when image_urls is empty.
--
-- settings.show_images_on_documents — opt-in. Off by default so existing studios
--                          do not suddenly get thumbnails on quotes that already
--                          have fabric_image_url populated from the catalogue.

alter table line_items
  add column if not exists image_urls text[] default '{}';

alter table settings
  add column if not exists show_images_on_documents boolean default false;

-- Images are stored in the existing public "sourcing-images" bucket under
-- line-items/<user_id>/<line_item_id>/<file>. No new bucket required.
