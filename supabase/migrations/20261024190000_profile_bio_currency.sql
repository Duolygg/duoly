-- Profile bio and languages (ledger #2) and per-account display currency (ledger #3).
-- Source rules: original lib/roles.js saveProfile/setCurrency and app/api/me/profile.
--   bio: at most 160 characters, no control characters except line breaks, trimmed.
--   languages: up to 6 from the fixed LANGUAGES list, no duplicates.
--   bio and languages are shown to customers, so only teammates can set them.
--   currency: EUR or USD, null until the person picks one (the homepage then auto-detects).
-- ACTIVATION ORDER: deploy the application code first (it reads these columns tolerantly),
-- then apply this migration. The customer order DTO gains teammate bio and languages.
begin;

create function public.profile_languages_valid(p_languages text[]) returns boolean
language sql immutable strict set search_path = '' as $$
  select pg_catalog.cardinality(p_languages) <= 6
    and pg_catalog.array_position(p_languages, null) is null
    and p_languages <@ array['English','German','French','Spanish','Portuguese','Italian','Dutch',
      'Polish','Swedish','Turkish','Russian','Ukrainian','Arabic','Japanese','Korean','Chinese']::text[]
    and (select pg_catalog.count(distinct l) from pg_catalog.unnest(p_languages) as l)
      = pg_catalog.cardinality(p_languages);
$$;
revoke all on function public.profile_languages_valid(text[]) from public, anon;
-- Pure check used by profiles_languages_check, which runs as the updating role.
grant execute on function public.profile_languages_valid(text[]) to authenticated, service_role;

alter table public.profiles
  add column bio text not null default '',
  add column languages text[] not null default '{}',
  add column currency text,
  add constraint profiles_bio_check check (
    pg_catalog.char_length(bio) <= 160
    and bio = pg_catalog.btrim(bio, E' \n\t')
    and pg_catalog.translate(bio, E'\n', '') !~ '[[:cntrl:]]'
  ),
  add constraint profiles_languages_check check (public.profile_languages_valid(languages)),
  add constraint profiles_currency_check check (currency is null or currency in ('EUR', 'USD'));

-- Signed-in people may change only their own bio/languages, and only as a teammate.
-- Trusted server code (no auth.uid()) is not restricted.
create function public.profiles_teammate_fields_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not exists (
    select 1 from public.account_roles as r where r.user_id = new.id and r.role = 'teammate'
  ) then
    raise exception 'Only teammates can set a bio and languages.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_teammate_fields_guard() from public, anon, authenticated, service_role;

create trigger profiles_teammate_fields
  before update of bio, languages on public.profiles
  for each row
  when (old.bio is distinct from new.bio or old.languages is distinct from new.languages)
  execute function public.profiles_teammate_fields_guard();

grant update (bio, languages, currency) on public.profiles to authenticated;

-- Latest definition: 20261024160000_order_reviews.sql. Only change: teammate bio and languages.
create or replace function public.order_customer_dto(p_order public.orders) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', p_order.id, 'public_reference', p_order.public_reference, 'status', p_order.status,
    'game', p_order.game, 'service', p_order.service, 'title', p_order.title,
    'units', p_order.units, 'unit', p_order.unit, 'gg', p_order.gg,
    'rank', p_order.rank, 'region', p_order.region, 'ign', p_order.ign, 'note', p_order.note, 'voice', p_order.voice,
    'amount_eur_cents', p_order.amount_eur_cents, 'created_at', p_order.created_at, 'queued_at', p_order.queued_at,
    'accepted_at', p_order.accepted_at, 'completed_at', p_order.completed_at, 'cancelled_at', p_order.cancelled_at,
    'cancel_reason', p_order.cancel_reason, 'rerolls', p_order.rerolls, 'current_assignment_id', p_order.current_assignment_id,
    'teammate', (select pg_catalog.jsonb_build_object('name', p.name, 'image', p.image, 'country', p.country,
        'bio', p.bio, 'languages', pg_catalog.to_jsonb(p.languages))
      from public.profiles as p where p.id = p_order.assigned_teammate_id),
    'review', (select public.order_review_dto(r) from public.order_reviews as r where r.order_id=p_order.id));
$$;

commit;
