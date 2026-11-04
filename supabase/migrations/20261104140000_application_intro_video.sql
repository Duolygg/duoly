-- Teammate applications: every new application must link a YouTube intro video where the applicant
-- talks (camera preferred, voice only is fine). Admins see it on the Applications screen.
--
-- teammate_applications.video: the link as pasted, '' for applications sent before this migration
-- (the admin screen shows "No intro video" for those). The column check only bounds the length, so the
-- old rows stay valid; submit_teammate_application requires a YouTube link for every new one.
-- The full id check (11 characters, watch / youtu.be / shorts / live / embed) is in
-- design-reference/lib/youtube.js, used by the form and POST /api/apply; this repeats the host rule.
--
-- Replaces submit_teammate_application from 20261024090000_admin_foundation.sql (one new argument,
-- p_video; the 12-argument version is dropped) and admin_application_dto (adds 'video').
-- Deploy order: this migration first, then the code that sends p_video.
begin;

alter table public.teammate_applications
  add column video text not null default '' check (pg_catalog.char_length(video) <= 200);

drop function public.submit_teammate_application(text,text,text,text,text,text,text,text,text,text,text,text[]);

create function public.submit_teammate_application(
  p_name text, p_email text, p_discord text, p_country text, p_game text, p_rank text, p_region text,
  p_role text, p_link text, p_hours text, p_why text, p_services text[], p_video text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_video text := pg_catalog.btrim(coalesce(p_video, ''));
  v public.teammate_applications;
begin
  if v_video !~* '^(https?://)?((www|m|music)\.)?youtube\.com/(watch\?|shorts/|live/|embed/)[^[:space:]]+$'
     and v_video !~* '^(https?://)?youtu\.be/[A-Za-z0-9_-]{11}([?#][^[:space:]]*)?$' then
    return public.order_error(400, 'Add a YouTube link to your intro video.');
  end if;
  -- Site-wide flood limit (spec: max 30 per hour). Serialized so concurrent submits can't overshoot.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('duoly.teammate_applications'));
  if exists (select 1 from public.teammate_applications where email = v_email and status = 'pending') then
    return public.order_error(409, 'You already have an application waiting. We’ll get back to you on Discord.');
  end if;
  if (select pg_catalog.count(*) from public.teammate_applications where submitted_at > pg_catalog.clock_timestamp() - interval '1 hour') >= 30 then
    return public.order_error(429, 'Too many applications right now. Try again in a bit.');
  end if;
  begin
    insert into public.teammate_applications(name, email, discord, country, game, rank, region, role, link, hours, why, services, video)
      values (p_name, v_email, p_discord, coalesce(p_country, ''), p_game, p_rank, p_region, coalesce(p_role, ''),
              coalesce(p_link, ''), p_hours, coalesce(p_why, ''), p_services, v_video)
      returning * into v;
  exception when check_violation or not_null_violation then
    return public.order_error(400, 'Please check the form and try again.');
  end;
  return pg_catalog.jsonb_build_object('application', pg_catalog.jsonb_build_object('id', v.id, 'reference', v.reference));
end;
$$;

create or replace function public.admin_application_dto(p public.teammate_applications) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', p.id, 'reference', p.reference, 'name', p.name, 'email', p.email, 'discord', p.discord,
    'country', p.country, 'game', p.game, 'rank', p.rank, 'region', p.region, 'role', p.role,
    'link', p.link, 'video', p.video, 'hours', p.hours, 'why', p.why, 'services', pg_catalog.to_jsonb(p.services),
    'submittedAt', p.submitted_at, 'status', p.status, 'reason', p.reason,
    'decidedBy', p.decided_by_name, 'decidedAt', p.decided_at, 'accountId', p.account_id);
$$;

revoke all on function public.admin_application_dto(public.teammate_applications) from public, anon, authenticated, service_role;
revoke all on function public.submit_teammate_application(text,text,text,text,text,text,text,text,text,text,text,text[],text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_teammate_application(text,text,text,text,text,text,text,text,text,text,text,text[],text)
  to anon, authenticated;

commit;
