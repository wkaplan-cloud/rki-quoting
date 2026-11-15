-- APPLIED 2026-11-15.
-- Platform feature switches are set only by the platform admin (service role,
-- /api/platform/studios/[id]/settings). Studio members may update their own
-- settings row from the browser (Studio Settings, onboarding), so any change
-- to these columns from a signed-in or anonymous user is undone here.
-- acceptance_enabled is a studio's own setting and is NOT locked.
create or replace function protect_platform_switches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.sourcing_enabled := false;
      new.studio_enabled := false;
      new.line_item_images_enabled := false;
      new.job_cost_sheet_enabled := false;
      new.delivery_timeline_enabled := false;
      new.insights_enabled := false;
      new.statements_enabled := false;
      new.duplicate_line_enabled := false;
      new.sticky_line_header_enabled := false;
      new.agent_enabled := false;
      new.ask_mia_enabled := false;
      new.capital_hotels_enabled := false;
    else
      new.sourcing_enabled := old.sourcing_enabled;
      new.studio_enabled := old.studio_enabled;
      new.line_item_images_enabled := old.line_item_images_enabled;
      new.job_cost_sheet_enabled := old.job_cost_sheet_enabled;
      new.delivery_timeline_enabled := old.delivery_timeline_enabled;
      new.insights_enabled := old.insights_enabled;
      new.statements_enabled := old.statements_enabled;
      new.duplicate_line_enabled := old.duplicate_line_enabled;
      new.sticky_line_header_enabled := old.sticky_line_header_enabled;
      new.agent_enabled := old.agent_enabled;
      new.ask_mia_enabled := old.ask_mia_enabled;
      new.capital_hotels_enabled := old.capital_hotels_enabled;
    end if;
  end if;
  return new;
end $$;

create or replace trigger protect_platform_switches before insert or update on settings
  for each row execute function protect_platform_switches();
