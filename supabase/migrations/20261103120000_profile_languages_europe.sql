-- More profile languages (owner request 2026-11-03): the rest of the European languages, Greek first.
--
-- profile_languages_valid is the 20261024190000_profile_bio_currency.sql version with a longer list;
-- the other rules (up to 6, no nulls, no duplicates) are unchanged. Every stored value stays valid,
-- since the list only grows. Deploy the code first: PROFILE_LANGUAGES offers the new languages.
begin;

create or replace function public.profile_languages_valid(p_languages text[]) returns boolean
language sql immutable strict set search_path = '' as $$
  select pg_catalog.cardinality(p_languages) <= 6
    and pg_catalog.array_position(p_languages, null) is null
    and p_languages <@ array['English','German','French','Spanish','Portuguese','Italian','Dutch',
      'Polish','Swedish','Turkish','Russian','Ukrainian','Greek','Czech','Slovak','Hungarian',
      'Romanian','Bulgarian','Croatian','Serbian','Slovenian','Bosnian','Albanian','Macedonian',
      'Danish','Norwegian','Finnish','Icelandic','Estonian','Latvian','Lithuanian','Catalan',
      'Arabic','Japanese','Korean','Chinese']::text[]
    and (select pg_catalog.count(distinct l) from pg_catalog.unnest(p_languages) as l)
      = pg_catalog.cardinality(p_languages);
$$;

commit;
