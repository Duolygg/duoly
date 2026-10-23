-- ACTIVATION GATE: applying grants enables direct authenticated completion RPCs.
-- Review/authorize application separately; no provider calls or loyalty posting.
begin;

alter table public.order_assignments drop constraint order_assignments_end_reason_check;
alter table public.order_assignments add constraint order_assignments_end_reason_check
  check (end_reason in ('customer_reroll','completed'));

create table public.teammate_earning_entries (
  order_id uuid primary key references public.orders(id) on delete restrict,
  assignment_id uuid not null unique,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null,
  proof_ids uuid[] not null check (pg_catalog.cardinality(proof_ids) between 1 and 5 and pg_catalog.array_position(proof_ids,null) is null),
  completed_at timestamptz not null,
  prior_completed_count bigint not null check (prior_completed_count >= 0),
  trust_tier text not null check (trust_tier in ('rookie','trusted','veteran','elite','legend')),
  payout_usd_cents integer not null check (payout_usd_cents between 99 and 10000000),
  deposit_percent integer not null check (deposit_percent in (0,3,5,8,10)),
  held_usd_cents integer not null check (held_usd_cents >= 0),
  net_usd_cents integer not null check (net_usd_cents >= 0 and held_usd_cents + net_usd_cents = payout_usd_cents),
  source_snapshot jsonb not null,
  result jsonb not null,
  foreign key (assignment_id,order_id,teammate_id)
    references public.order_assignments(id,order_id,teammate_id) on delete restrict,
  unique (teammate_id,request_id),
  check (held_usd_cents = (payout_usd_cents * deposit_percent + 50) / 100),
  check (
    (prior_completed_count < 100 and trust_tier='rookie' and deposit_percent=10)
    or (prior_completed_count >= 100 and prior_completed_count < 250 and trust_tier='trusted' and deposit_percent=8)
    or (prior_completed_count >= 250 and prior_completed_count < 500 and trust_tier='veteran' and deposit_percent=5)
    or (prior_completed_count >= 500 and prior_completed_count < 1000 and trust_tier='elite' and deposit_percent=3)
    or (prior_completed_count >= 1000 and trust_tier='legend' and deposit_percent=0)
  )
);
create index teammate_earnings_history on public.teammate_earning_entries(teammate_id,completed_at desc,order_id);
alter table public.teammate_earning_entries enable row level security;
revoke all on table public.teammate_earning_entries from public,anon,authenticated,service_role;

create table public.order_completion_proofs (
  order_id uuid not null references public.teammate_earning_entries(order_id) on delete restrict,
  proof_id uuid primary key references public.order_proof_uploads(id) on delete restrict
);
alter table public.order_completion_proofs enable row level security;
revoke all on table public.order_completion_proofs from public,anon,authenticated,service_role;
create function public.completion_immutable_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise sqlstate 'PT409' using message='Completion audit records are immutable.';
end $$;
create trigger teammate_earnings_immutable before update or delete on public.teammate_earning_entries
  for each row execute function public.completion_immutable_guard();
create trigger completion_proofs_immutable before update or delete on public.order_completion_proofs
  for each row execute function public.completion_immutable_guard();
revoke all on function public.completion_immutable_guard() from public,anon,authenticated,service_role;

create function public.completion_trust(p_prior_completed_count bigint) returns jsonb
language sql immutable security invoker set search_path = '' as $$
 select pg_catalog.jsonb_build_object('trust_tier',t.tier,'deposit_percent',t.percent)
 from (values (0,'rookie',10),(100,'trusted',8),(250,'veteran',5),(500,'elite',3),(1000,'legend',0))
   as t(threshold,tier,percent)
 where t.threshold <= p_prior_completed_count order by t.threshold desc limit 1;
$$;
revoke all on function public.completion_trust(bigint) from public,anon,authenticated,service_role;

create function public.complete_order(p_order_id uuid,p_assignment_id uuid,p_proof_ids uuid[],p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; pay public.order_payments;
 v_proofs uuid[]; v_count bigint; v_now timestamptz; v_held integer; v_result jsonb; v_trust jsonb; v_percent integer;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 -- Same role -> access -> order lock order as accept/chat. Serializes all of
 -- this teammate's completions, including retries and future tier progression.
 perform 1 from public.account_roles where user_id=v_actor and role='teammate' for update;
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 perform 1 from public.teammate_order_access where user_id=v_actor for share;
 if p_order_id is null or p_assignment_id is null or p_request_id is null
   or p_proof_ids is null or pg_catalog.cardinality(p_proof_ids) not between 1 and 5
   or coalesce(pg_catalog.array_ndims(p_proof_ids),1) <> 1
   or pg_catalog.array_position(p_proof_ids,null) is not null then
   return public.order_error(400,'Select one to five distinct ready screenshots.');
 end if;
 select pg_catalog.array_agg(distinct x order by x) into v_proofs from pg_catalog.unnest(p_proof_ids) as x;
 if pg_catalog.cardinality(v_proofs) <> pg_catalog.cardinality(p_proof_ids) then
   return public.order_error(400,'Select one to five distinct ready screenshots.');
 end if;
 select o.* into v from public.orders as o where o.id=p_order_id for update;
 if v.id is null or not coalesce(public.order_proof_player(v,v_actor),false) then
   return public.order_error(404,'Order not found.');
 end if;
 -- The role/access/order locks precede replay too; a stale JWT cannot replay.
 if exists(select 1 from public.teammate_earning_entries where order_id=v.id) then
   select e.result into v_result from public.teammate_earning_entries as e
     where e.order_id=v.id and e.teammate_id=v_actor and e.assignment_id=p_assignment_id
       and e.request_id=p_request_id and e.proof_ids=v_proofs;
   if found then return v_result; end if;
   return public.order_error(409,'Completion already recorded with another request or proof set.');
 end if;
 if exists(select 1 from public.teammate_earning_entries where teammate_id=v_actor and request_id=p_request_id) then
   return public.order_error(409,'Request UUID already bound to another completion.');
 end if;
 if v.status <> 'in_progress' or v.current_assignment_id <> p_assignment_id
   or not exists(select 1 from public.order_assignments where id=p_assignment_id and ended_at is null) then
   return public.order_error(409,'Assignment unavailable.');
 end if;
 select p.* into pay from public.order_payments as p where p.order_id=v.id for update;
 if pay.order_id is null or pay.state <> 'captured' or pay.settle <> 'none' then
   return public.order_error(409,'Captured settled payment required.');
 end if;
 perform 1 from public.order_proof_uploads as p where p.id=any(v_proofs) order by p.id for share;
 if (select count(*) from public.order_proof_uploads as p where p.id=any(v_proofs)
   and p.order_id=v.id and p.assignment_id=p_assignment_id and p.uploader_id=v_actor and p.state='ready') <> pg_catalog.cardinality(v_proofs) then
   return public.order_error(400,'Select ready screenshots from this assignment.');
 end if;
 select count(*) into v_count from public.teammate_earning_entries where teammate_id=v_actor;
 v_now := pg_catalog.clock_timestamp();
 v_trust := public.completion_trust(v_count);
 v_percent := (v_trust->>'deposit_percent')::integer;
 v_held := (v.payout_usd_cents * v_percent + 50) / 100;
 v_result := pg_catalog.jsonb_build_object('completion',pg_catalog.jsonb_build_object(
   'order_id',v.id,'assignment_id',p_assignment_id,'request_id',p_request_id,'proof_ids',v_proofs,
   'completed_at',v_now,'payout_usd_cents',v.payout_usd_cents,'deposit_percent',v_percent,
   'held_usd_cents',v_held,'net_usd_cents',v.payout_usd_cents-v_held,'trust_tier',v_trust->>'trust_tier'));
 insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,
   prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values(v.id,p_assignment_id,v_actor,p_request_id,v_proofs,v_now,v_count,v_trust->>'trust_tier',v.payout_usd_cents,v_percent,
   v_held,v.payout_usd_cents-v_held,pg_catalog.jsonb_build_object('payout_usd_cents',v.payout_usd_cents,
   'booking_fx',v.booking_fx,'payment_intent_id',pay.intent_id,'payment_state',pay.state,'payment_settle',pay.settle),v_result);
 insert into public.order_completion_proofs(order_id,proof_id)
   select v.id,x from pg_catalog.unnest(v_proofs) as x;
 update public.order_assignments set ended_at=v_now,end_reason='completed' where id=p_assignment_id;
 -- Existing assignment trigger abandons pending uploads. Existing order trigger
 -- emits the one completion system message; do not append a second one here.
 update public.orders set status='completed',completed_at=v_now where id=v.id;
 return v_result;
end $$;
revoke all on function public.complete_order(uuid,uuid,uuid[],uuid) from public,anon,authenticated,service_role;
grant execute on function public.complete_order(uuid,uuid,uuid[],uuid) to authenticated;
create function public.teammate_earnings(p_limit integer default 20,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate' for share;
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then
   return public.order_error(400,'Invalid pagination.');
 end if;
 select coalesce(pg_catalog.jsonb_agg(q.result->'completion' order by q.completed_at desc,q.order_id),'[]'::jsonb)
   into v_result from (select e.result,e.completed_at,e.order_id from public.teammate_earning_entries as e
     where e.teammate_id=v_actor order by e.completed_at desc,e.order_id limit p_limit offset p_offset) as q;
 return pg_catalog.jsonb_build_object('earnings',v_result);
end $$;
revoke all on function public.teammate_earnings(integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.teammate_earnings(integer,integer) to authenticated;

-- Historical-final membership only. Existing send/typing RPCs independently
-- require in_progress; rerolled assignments remain inaccessible to teammates.
create or replace function public.order_chat_viewer(p_order public.orders,p_assignment_id uuid) returns text
language sql stable security invoker set search_path = '' as $$
  select case
    when r.role = 'admin' then 'admin'
    when r.role = 'customer' and p_order.customer_id = auth.uid() then 'customer'
    when r.role = 'teammate' and exists (
      select 1 from public.order_assignments as a
      join public.teammate_order_access as x on x.user_id = a.teammate_id
      where a.id = p_assignment_id and a.order_id = p_order.id
        and a.teammate_id = auth.uid()
        and ((a.end_reason is null and a.ended_at is null and p_order.status='in_progress')
          or (a.end_reason='completed' and a.ended_at is not null and p_order.status='completed'))
        and p_order.current_assignment_id = a.id and p_order.assigned_teammate_id = a.teammate_id
        and not x.suspended and x.discord_id is not null and x.discord_verified_at is not null
        and ((x.gg_access and p_order.gg) or (not x.gg_access and not p_order.gg and p_order.game = any(x.approved_games)))
    ) then 'teammate' else null end
  from public.account_roles as r where r.user_id = auth.uid();
$$;
revoke all on function public.order_chat_viewer(public.orders,uuid) from public,anon,authenticated,service_role;
commit;
