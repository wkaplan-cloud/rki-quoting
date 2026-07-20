-- da Marco's supplier_category already says 'manufacturer', but the field
-- the app actually checks for the manufacturing-portal redirect is
-- plan_category, which was null — so they were falling through to the
-- general/Sourcing-based home page (now removed) instead of their own
-- manufacturing dashboard. Aligning plan_category with what the account
-- already self-declares.
update supplier_portal_accounts
set plan_category = 'manufacturer'
where email = 'gary@damarco.co.za';
