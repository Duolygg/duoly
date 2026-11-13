-- Purpose: the trophy case. Teammates submit in-game achievements (rank, leaderboard spot,
-- tournament result, title) with a proof image or link; staff approve or reject them in one
-- queue; the public profile shows approved ones only. Proof images live in a private bucket and
-- are deleted through the storage cleanup queue when their trophy goes.
-- Apply notes: OWNER APPROVAL REQUIRED. Apply after the app deploy that reads it (the page treats
-- a missing function as an empty case). Never db push.
begin;

create function public.teammate_trophy_text_ok(p_text text, p_max integer) returns boolean
language sql immutable set search_path = '' as $$
  select p_text is null or (pg_catalog.char_length(pg_catalog.btrim(p_text)) between 1 and p_max
    and p_text = pg_catalog.btrim(p_text) and p_text !~ '[<>[:cntrl:]]');
$$;

create table public.teammate_trophies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9]{2,8}$'),
  kind text not null check (kind in ('rank', 'leaderboard', 'tournament', 'title')),
  ladder text check (ladder ~ '^[a-z0-9-]{1,24}$'),
  tier text check (tier ~ '^[a-z0-9-]{1,40}$'),
  division text check (public.teammate_trophy_text_ok(division, 8)),
  value integer check (value between 0 and 1000000),
  moment text check (moment in ('peak', 'season_end', 'current')),
  season text check (public.teammate_trophy_text_ok(season, 40)),
  region text check (public.teammate_trophy_text_ok(region, 32)),
  position integer check (position between 1 and 1000000),
  event text check (public.teammate_trophy_text_ok(event, 80)),
  title text check (public.teammate_trophy_text_ok(title, 60)),
  achieved_on date check (achieved_on between date '2009-01-01' and date '2100-01-01'),
  proof_url text check (proof_url ~ '^https://[^[:space:]<>"]+$' and pg_catalog.char_length(proof_url) <= 500),
  proof_path text check (proof_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{16}\.(webp|jpg)$'),
  note text check (public.teammate_trophy_text_ok(note, 400)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  review_note text check (public.teammate_trophy_text_ok(review_note, 300)),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check (proof_url is not null or proof_path is not null),
  check (proof_path is null or pg_catalog.starts_with(proof_path, user_id::text || '/')),
  check ((status = 'pending') = (reviewed_at is null)),
  check (kind <> 'rank' or (ladder is not null and tier is not null and moment is not null and season is not null)),
  check (kind <> 'leaderboard' or (position is not null and season is not null)),
  check (kind <> 'tournament' or (event is not null and position is not null)),
  check (kind <> 'title' or title is not null)
);
create index teammate_trophies_user on public.teammate_trophies(user_id, status, reviewed_at desc);
create index teammate_trophies_queue on public.teammate_trophies(status, created_at) where status = 'pending';
alter table public.teammate_trophies enable row level security;
revoke all on table public.teammate_trophies from public, anon, authenticated, service_role;

-- Proof screenshots: private, written by the app server only, read by staff through signed URLs.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('trophy-proofs', 'trophy-proofs', false, 1048576, array['image/webp','image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy trophy_proofs_no_raw_clients on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'trophy-proofs') with check (bucket_id <> 'trophy-proofs');

-- One trophy as JSON. The owner also sees status, the staff note and whether an image is on file.
create function public.teammate_trophy_json(t public.teammate_trophies, p_own boolean) returns jsonb
language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_build_object('id', t.id, 'game', t.game, 'kind', t.kind, 'ladder', t.ladder,
    'tier', t.tier, 'division', t.division, 'value', t.value, 'moment', t.moment, 'season', t.season,
    'region', t.region, 'position', t.position, 'event', t.event, 'title', t.title,
    'achievedOn', t.achieved_on, 'proofUrl', t.proof_url, 'rarity', t.rarity,
    'verifiedAt', case when t.status = 'approved' then t.reviewed_at end)
  || case when p_own then pg_catalog.jsonb_build_object('status', t.status, 'reviewNote', t.review_note,
       'hasImage', t.proof_path is not null, 'createdAt', t.created_at) else '{}'::jsonb end;
$$;

create function public.teammate_trophy_order(p_rarity text) returns integer
language sql immutable set search_path = '' as $$
  select pg_catalog.array_position(array['common','uncommon','rare','epic','legendary','mythic'], p_rarity);
$$;

create function public.teammate_trophy_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists(select 1 from public.account_roles where user_id = actor and role = 'teammate') then
    return public.order_error(403, 'Teammates only.');
  end if;
  return pg_catalog.jsonb_build_object('trophies', coalesce((select pg_catalog.jsonb_agg(
      public.teammate_trophy_json(t, true) order by t.created_at desc, t.id)
    from public.teammate_trophies t where t.user_id = actor), '[]'::jsonb));
end $$;

create function public.teammate_trophy_submit(p_trophy jsonb, p_proof_path text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); row public.teammate_trophies;
begin
  if actor is null or not exists(select 1 from public.account_roles where user_id = actor and role = 'teammate') then
    return public.order_error(403, 'Teammates only.');
  end if;
  if pg_catalog.jsonb_typeof(p_trophy) <> 'object' then return public.order_error(400, 'Check the trophy.'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('teammate_trophies:' || actor::text, 0));
  if not public.teammate_public_approved(actor, p_trophy->>'game') then
    return public.order_error(400, 'Add trophies for games you are approved for.');
  end if;
  if (select pg_catalog.count(*) from public.teammate_trophies where user_id = actor and status <> 'rejected') >= 24 then
    return public.order_error(409, 'Your trophy case is full. Remove one first.');
  end if;
  if (select pg_catalog.count(*) from public.teammate_trophies where user_id = actor and status = 'pending') >= 6 then
    return public.order_error(409, 'Six trophies are waiting for review. Add more once they are checked.');
  end if;
  begin
    insert into public.teammate_trophies(user_id, game, kind, ladder, tier, division, value, moment, season,
      region, position, event, title, achieved_on, proof_url, proof_path, note, rarity)
    values (actor, p_trophy->>'game', p_trophy->>'kind', p_trophy->>'ladder', p_trophy->>'tier',
      p_trophy->>'division', (p_trophy->>'value')::integer, p_trophy->>'moment', p_trophy->>'season',
      p_trophy->>'region', (p_trophy->>'position')::integer, p_trophy->>'event', p_trophy->>'title',
      (p_trophy->>'achievedOn')::date, p_trophy->>'proofUrl', p_proof_path, p_trophy->>'note',
      coalesce(p_trophy->>'rarity', 'common'))
    returning * into row;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range
    or invalid_datetime_format or datetime_field_overflow or not_null_violation then
    return public.order_error(400, 'Check the trophy.');
  end;
  return pg_catalog.jsonb_build_object('trophy', public.teammate_trophy_json(row, true));
end $$;

create function public.teammate_trophy_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); was_public boolean;
begin
  if actor is null then return public.order_error(403, 'Teammates only.'); end if;
  delete from public.teammate_trophies where id = p_id and user_id = actor returning status = 'approved' into was_public;
  if not found then return public.order_error(404, 'Trophy not found.'); end if;
  if was_public then
    update public.teammate_public_profiles set updated_at = pg_catalog.clock_timestamp() where user_id = actor;
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end $$;

create function public.admin_trophy_queue(p_status text default 'pending', p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_caller_for('teammates')) then return public.order_error(403, 'Admins only.'); end if;
  if p_status not in ('pending', 'approved', 'rejected') then return public.order_error(400, 'Pick a status.'); end if;
  return pg_catalog.jsonb_build_object('trophies', coalesce((select pg_catalog.jsonb_agg(q.item order by q.n) from (
    select pg_catalog.row_number() over (order by case when p_status = 'pending' then t.created_at end,
        t.reviewed_at desc nulls last, t.id) as n,
      public.teammate_trophy_json(t, true) || pg_catalog.jsonb_build_object('userId', t.user_id, 'teammate', pr.name,
        'slug', pp.slug, 'note', t.note, 'proofPath', t.proof_path, 'reviewedAt', t.reviewed_at) as item
    from public.teammate_trophies t
    join public.profiles pr on pr.id = t.user_id
    left join public.teammate_public_profiles pp on pp.user_id = t.user_id
    where t.status = p_status
    order by case when p_status = 'pending' then t.created_at end, t.reviewed_at desc nulls last, t.id
    limit greatest(1, least(coalesce(p_limit, 50), 200))) q), '[]'::jsonb));
end $$;

create function public.admin_trophy_review(p_id uuid, p_decision text, p_rarity text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; actor_name text; row public.teammate_trophies;
begin
  select id, name into actor, actor_name from public.admin_caller_for('teammates');
  if actor is null then return public.order_error(403, 'Admins only.'); end if;
  if p_decision not in ('approved', 'rejected') then return public.order_error(400, 'Approve or reject.'); end if;
  if p_decision = 'rejected' and pg_catalog.btrim(coalesce(p_note, '')) = '' then
    return public.order_error(400, 'Say why, the teammate sees this note.');
  end if;
  begin
    update public.teammate_trophies set status = p_decision, rarity = coalesce(p_rarity, rarity),
      review_note = nullif(pg_catalog.btrim(coalesce(p_note, '')), ''), reviewed_by = actor,
      reviewed_at = pg_catalog.clock_timestamp()
    where id = p_id returning * into row;
  exception when check_violation then return public.order_error(400, 'Check the rarity and note.');
  end;
  if not found then return public.order_error(404, 'Trophy not found.'); end if;
  update public.teammate_public_profiles set updated_at = pg_catalog.clock_timestamp() where user_id = row.user_id;
  perform public.admin_log(actor, actor_name,
    case when p_decision = 'approved' then 'Approved trophy' else 'Rejected trophy' end,
    row.user_id::text, row.game || ': ' || coalesce(row.tier, row.event, row.title, row.position::text, row.kind));
  return pg_catalog.jsonb_build_object('trophy', public.teammate_trophy_json(row, true));
end $$;

-- Same visibility rule as public_teammate_profile: published, not hidden, active, approved.
create function public.public_teammate_trophies(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.teammate_public_profiles;
begin
  select * into p from public.teammate_public_profiles where slug = p_slug;
  if not found or not p.published or p.admin_hidden or not public.teammate_public_active(p.user_id)
    or not public.teammate_public_approved(p.user_id, p.featured_game) then
    return '[]'::jsonb;
  end if;
  return coalesce((select pg_catalog.jsonb_agg(public.teammate_trophy_json(t, false)
      order by public.teammate_trophy_order(t.rarity) desc, t.reviewed_at desc, t.id)
    from (select * from public.teammate_trophies t where t.user_id = p.user_id and t.status = 'approved'
      order by public.teammate_trophy_order(t.rarity) desc, t.reviewed_at desc, t.id limit 24) t), '[]'::jsonb);
end $$;

-- Storage cleanup: proof files join the queue when their trophy row goes (withdrawn, account
-- deleted). The claim re-checks use, so a file another row still points at is never deleted.
alter table public.storage_cleanup drop constraint storage_cleanup_bucket_check;
alter table public.storage_cleanup add constraint storage_cleanup_bucket_check
  check (bucket in ('avatars', 'profile-headers', 'trophy-proofs'));

create function public.storage_cleanup_trophies() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.proof_path is not null then
    perform public.storage_cleanup_enqueue('trophy-proofs', old.proof_path, 'replaced');
  end if;
  return null;
exception when others then
  raise warning 'storage_cleanup_trophies failed [%]: %', sqlstate, sqlerrm;
  return null;
end;
$$;
revoke all on function public.storage_cleanup_trophies() from public, anon, authenticated, service_role;
create trigger storage_cleanup_trophies after delete on public.teammate_trophies
  for each row execute function public.storage_cleanup_trophies();

create or replace function public.storage_cleanup_in_use(p_bucket text, p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_bucket
    when 'avatars' then
      exists (select 1 from public.profiles p
        where pg_catalog.split_part(p.image, '/storage/v1/object/public/avatars/', 2) = p_path)
      or exists (select 1 from public.order_chat_messages m
        where pg_catalog.split_part(m.image, '/storage/v1/object/public/avatars/', 2) = p_path)
      or exists (select 1 from public.support_conversations s
        where pg_catalog.split_part(s.image, '/storage/v1/object/public/avatars/', 2) = p_path)
      or exists (select 1 from public.order_chat_attempts a
        where pg_catalog.strpos(a.result::text, '/storage/v1/object/public/avatars/' || p_path) > 0)
    when 'trophy-proofs' then
      exists (select 1 from public.teammate_trophies t where t.proof_path = p_path)
    else
      exists (select 1 from public.teammate_public_profiles t
        where pg_catalog.split_part(t.header_image, '/storage/v1/object/public/profile-headers/', 2) = p_path)
  end;
$$;
revoke all on function public.storage_cleanup_in_use(text, text) from public, anon, authenticated, service_role;

DO $acl$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('teammate_trophy_text_ok', 'teammate_trophy_json', 'teammate_trophy_order',
      'teammate_trophy_list', 'teammate_trophy_submit', 'teammate_trophy_delete', 'admin_trophy_queue',
      'admin_trophy_review', 'public_teammate_trophies')
  loop execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', f); end loop;
end $acl$;
grant execute on function public.public_teammate_trophies(text) to anon, authenticated;
grant execute on function public.teammate_trophy_list(), public.teammate_trophy_submit(jsonb, text),
  public.teammate_trophy_delete(uuid), public.admin_trophy_queue(text, integer),
  public.admin_trophy_review(uuid, text, text, text) to authenticated;
-- The JSON helpers run inside the definer functions above; they never need a direct grant.

commit;
