-- Diamond customers get Duoly PRO free while they are Diamond (owner decision 2026-11-05).
--
-- is_pro() stays the one rule for every PRO perk (the 10% discount at checkout, unlimited re-rolls
-- in reroll_order, the 'pro' priority head start), so Diamond counts there and every perk follows.
-- Diamond is the loyalty level the server computes (loyalty_level index 4, 1000 valid orders, the
-- same rule as the Diamond pick). Dropping below Diamond (refunds) ends the free PRO.
--
-- pro_status_dto gains 'included': PRO comes with Diamond. A paid subscription is never touched here:
-- a Diamond who still pays sees in the dashboard that PRO is included and how to cancel the paid one
-- in Manage PRO. New PRO checkouts are already refused for members ("You already have Duoly PRO.").
--
-- From 20261026120000_pro_subscription.sql: is_pro, pro_status_dto (each notes its change; grants kept).
begin;

create function public.pro_included(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null
    and (public.loyalty_level(public.loyalty_valid_count(p_user))->>'index')::integer >= 4;
$$;

-- From 20261026120000_pro_subscription.sql; changed: Diamond counts as PRO.
create or replace function public.is_pro(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and (exists (
    select 1 from public.pro_subscriptions as s
    where s.user_id = p_user
      and (
        (s.status in ('trialing','active')
          and (s.current_period_end is null
               or s.current_period_end > pg_catalog.clock_timestamp() - interval '3 days'))
        or (s.status = 'past_due'
          and s.past_due_since > pg_catalog.clock_timestamp() - interval '3 days')))
    or public.pro_included(p_user));
$$;

-- From 20261026120000_pro_subscription.sql; changed: 'included'.
create or replace function public.pro_status_dto(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'member', public.is_pro(p_user),
    'included', public.pro_included(p_user),
    'trial_eligible', public.pro_trial_eligible(p_user),
    'has_customer', exists (select 1 from public.pro_billing_customers as c where c.user_id = p_user),
    'subscription', (
      select pg_catalog.jsonb_build_object(
        'status', s.status,
        'trial_end', s.trial_end,
        'current_period_end', s.current_period_end,
        'cancel_at_period_end', s.cancel_at_period_end,
        'grace_until', case when s.status = 'past_due' then s.past_due_since + interval '3 days' end)
      from public.pro_subscriptions as s
      where s.user_id = p_user
      order by (s.status in ('trialing','active','past_due')) desc, s.updated_at desc
      limit 1));
$$;

revoke all on function public.pro_included(uuid) from public, anon, authenticated, service_role;

commit;
