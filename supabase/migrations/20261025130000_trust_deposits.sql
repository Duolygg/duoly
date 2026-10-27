-- Trust deposits (#13): dispute-aware release, immutable forfeiture audit and TrustScore data.
-- Deploy code first (the stats contract accepts the old and new payload), then apply this migration,
-- then enable charge.dispute.created, charge.dispute.updated and charge.dispute.closed on the Stripe webhook.
begin;

create extension if not exists pg_cron with schema pg_catalog;

alter table public.order_payments
  add column dispute_status text check (dispute_status is null or dispute_status in ('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost')),
  add column disputed_at timestamptz;

create table public.stripe_disputes (
  id text primary key check (id ~ '^dp_[A-Za-z0-9]+$'),
  order_id uuid not null references public.orders(id) on delete restrict,
  charge_id text not null check (charge_id ~ '^ch_[A-Za-z0-9]+$'),
  payment_intent_id text not null check (payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  status text not null check (status in ('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost')),
  reason text not null check (pg_catalog.char_length(reason) between 1 and 80),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  closed_at timestamptz,
  unique (id,order_id),
  foreign key (payment_intent_id) references public.order_payments(stripe_payment_intent_id) on delete restrict,
  check ((status in ('won','lost','warning_closed')) = (closed_at is not null))
);
create index stripe_disputes_order_status on public.stripe_disputes(order_id,status);
alter table public.stripe_disputes enable row level security;
revoke all on table public.stripe_disputes from public,anon,authenticated,service_role;

create table public.deposit_releases (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  earning_id uuid not null unique references public.teammate_earning_entries(order_id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  release_at timestamptz not null,
  state text not null default 'waiting' check (state in ('waiting','blocked','released','forfeited')),
  reason text not null default '',
  released_at timestamptz,
  forfeited_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((state='released') = (released_at is not null)),
  check ((state='forfeited') = (forfeited_at is not null)),
  check (not (released_at is not null and forfeited_at is not null))
);
create index deposit_releases_due on public.deposit_releases(release_at,earning_id) where state in ('waiting','blocked');
create index deposit_releases_teammate on public.deposit_releases(teammate_id,state,release_at desc);
alter table public.deposit_releases enable row level security;
revoke all on table public.deposit_releases from public,anon,authenticated,service_role;

create table public.deposit_release_events (
  id bigint generated always as identity primary key,
  earning_id uuid not null references public.teammate_earning_entries(order_id) on delete restrict,
  from_state text,
  to_state text not null check (to_state in ('waiting','blocked','released','forfeited')),
  reason text not null check (pg_catalog.char_length(reason) between 1 and 300),
  source text not null check (source in ('completion','release_job','report','stripe_dispute')),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index deposit_release_events_earning on public.deposit_release_events(earning_id,id);
alter table public.deposit_release_events enable row level security;
revoke all on table public.deposit_release_events from public,anon,authenticated,service_role;
create trigger deposit_release_events_immutable before update or delete on public.deposit_release_events
  for each row execute function public.completion_immutable_guard();

create function public.deposit_release_after_earning() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.deposit_releases(earning_id,teammate_id,release_at)
    values(new.order_id,new.teammate_id,new.completed_at+interval '14 days');
  insert into public.deposit_release_events(earning_id,from_state,to_state,reason,source)
    values(new.order_id,null,'waiting','Deposit recorded for release 14 days after completion','completion');
  return new;
end $$;
revoke all on function public.deposit_release_after_earning() from public,anon,authenticated,service_role;
create trigger teammate_earning_deposit_release after insert on public.teammate_earning_entries
  for each row execute function public.deposit_release_after_earning();

insert into public.deposit_releases(earning_id,teammate_id,release_at)
select e.order_id,e.teammate_id,e.completed_at+interval '14 days'
from public.teammate_earning_entries e
on conflict (earning_id) do nothing;
insert into public.deposit_release_events(earning_id,from_state,to_state,reason,source)
select r.earning_id,null,'waiting','Existing deposit added to release schedule','completion'
from public.deposit_releases r
where not exists(select 1 from public.deposit_release_events x where x.earning_id=r.earning_id);

create function public.refresh_deposit_release(p_order_id uuid,p_source text,p_reason text) returns text
language plpgsql security definer set search_path='' as $$
declare v public.deposit_releases; v_next text; v_reason text;
begin
  select r.* into v from public.deposit_releases r where r.earning_id=p_order_id for update;
  if v.id is null or v.state in ('released','forfeited') then return coalesce(v.state,'missing'); end if;
  if exists(select 1 from public.order_reports r where r.order_id=p_order_id and r.status='approved')
     or exists(select 1 from public.stripe_disputes d where d.order_id=p_order_id and d.status='lost') then
    v_next:='forfeited';
    v_reason:=pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_reason),''),'Deposit forfeited after an upheld report or lost Stripe dispute'),300);
  elsif exists(select 1 from public.order_reports r where r.order_id=p_order_id and r.status='open')
     or exists(select 1 from public.stripe_disputes d where d.order_id=p_order_id and d.status in ('warning_needs_response','warning_under_review','needs_response','under_review')) then
    v_next:='blocked';
    v_reason:=pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_reason),''),'Deposit blocked while a report or Stripe dispute is open'),300);
  else
    v_next:='waiting';
    v_reason:=pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_reason),''),'No open report or Stripe dispute'),300);
  end if;
  if v_next<>v.state or v.reason is distinct from v_reason then
    update public.deposit_releases set state=v_next,reason=v_reason,
      forfeited_at=case when v_next='forfeited' then pg_catalog.clock_timestamp() end,
      updated_at=pg_catalog.clock_timestamp() where id=v.id;
    insert into public.deposit_release_events(earning_id,from_state,to_state,reason,source)
      values(p_order_id,v.state,v_next,v_reason,p_source);
    if v_next='forfeited' then
      perform public.admin_log(null,case when p_source='stripe_dispute' then 'Stripe' else 'Duoly' end,'Forfeited deposit',
        (select o.public_reference from public.orders o where o.id=p_order_id),v_reason);
    end if;
  end if;
  return v_next;
end $$;
revoke all on function public.refresh_deposit_release(uuid,text,text) from public,anon,authenticated,service_role;

create function public.order_report_deposit_refresh() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform public.refresh_deposit_release(new.order_id,'report',
    case new.status when 'approved' then 'Report upheld: '||new.decision_reason
      when 'rejected' then 'Report rejected: '||new.decision_reason
      else 'Report opened and awaiting review' end);
  return new;
end $$;
revoke all on function public.order_report_deposit_refresh() from public,anon,authenticated,service_role;
create trigger order_reports_deposit_refresh after insert or update of status on public.order_reports
  for each row execute function public.order_report_deposit_refresh();

create function public.record_stripe_dispute(p_dispute_id text,p_charge_id text,p_payment_intent text,p_status text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_order uuid; v_action text;
begin
  if p_dispute_id!~'^dp_[A-Za-z0-9]+$' or p_charge_id!~'^ch_[A-Za-z0-9]+$' or p_payment_intent!~'^pi_[A-Za-z0-9]+$'
    or p_status not in ('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost')
    or pg_catalog.char_length(coalesce(p_reason,'')) not between 1 and 80 then
    raise exception 'invalid Stripe dispute';
  end if;
  select order_id into v_order from public.order_payments where stripe_payment_intent_id=p_payment_intent for update;
  if v_order is null then return pg_catalog.jsonb_build_object('updated',false); end if;
  insert into public.stripe_disputes(id,order_id,charge_id,payment_intent_id,status,reason,closed_at)
    values(p_dispute_id,v_order,p_charge_id,p_payment_intent,p_status,p_reason,
      case when p_status in ('won','lost','warning_closed') then pg_catalog.clock_timestamp() end)
  on conflict(id) do update set charge_id=excluded.charge_id,payment_intent_id=excluded.payment_intent_id,
    status=excluded.status,reason=excluded.reason,updated_at=pg_catalog.clock_timestamp(),closed_at=excluded.closed_at
    where public.stripe_disputes.order_id=excluded.order_id;
  update public.order_payments set dispute_status=p_status,
    disputed_at=coalesce(disputed_at,pg_catalog.clock_timestamp()),updated_at=pg_catalog.clock_timestamp()
    where order_id=v_order;
  v_action:=public.refresh_deposit_release(v_order,'stripe_dispute',
    case p_status when 'lost' then 'Stripe dispute lost: '||p_reason
      when 'won' then 'Stripe dispute won: '||p_reason
      when 'warning_closed' then 'Stripe dispute warning closed: '||p_reason
      else 'Stripe dispute open: '||p_reason end);
  return pg_catalog.jsonb_build_object('updated',true,'orderId',v_order,'depositState',v_action);
end $$;
revoke all on function public.record_stripe_dispute(text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_stripe_dispute(text,text,text,text,text) to service_role;

create function public.release_due_deposits(p_limit integer default 1000) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v record; v_state text; v_count integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 5000 then raise exception 'invalid release limit'; end if;
  for v in select earning_id from public.deposit_releases
    where state in ('waiting','blocked') and release_at<=pg_catalog.clock_timestamp()
    order by release_at,earning_id for update skip locked limit p_limit loop
    v_state:=public.refresh_deposit_release(v.earning_id,'release_job','Deposit release eligibility checked');
    if v_state='waiting' then
      update public.deposit_releases set state='released',reason='Released 14 days after completion with no open report or Stripe dispute',
        released_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp() where earning_id=v.earning_id;
      insert into public.deposit_release_events(earning_id,from_state,to_state,reason,source)
        values(v.earning_id,'waiting','released','Released 14 days after completion with no open report or Stripe dispute','release_job');
      v_count:=v_count+1;
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('released',v_count);
end $$;
revoke all on function public.release_due_deposits(integer) from public,anon,authenticated,service_role;
grant execute on function public.release_due_deposits(integer) to service_role;

select cron.schedule('trust-deposit-release','17 * * * *','select public.release_due_deposits(1000);');
select cron.alter_job(jobid,active:=true) from cron.job where jobname='trust-deposit-release' and username=current_user;

-- Latest definition is 20261024130000_order_completion.sql. Only the progression count changes.
create or replace function public.complete_order(p_order_id uuid,p_assignment_id uuid,p_proof_ids uuid[],p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; pay public.order_payments;
 v_proofs uuid[]; v_count bigint; v_now timestamptz; v_held integer; v_result jsonb; v_trust jsonb; v_percent integer;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate' for update;
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 perform 1 from public.teammate_order_access where user_id=v_actor for share;
 if p_order_id is null or p_assignment_id is null or p_request_id is null or p_proof_ids is null
   or pg_catalog.cardinality(p_proof_ids) not between 1 and 5 or coalesce(pg_catalog.array_ndims(p_proof_ids),1)<>1
   or pg_catalog.array_position(p_proof_ids,null) is not null then return public.order_error(400,'Select one to five distinct ready screenshots.'); end if;
 select pg_catalog.array_agg(distinct x order by x) into v_proofs from pg_catalog.unnest(p_proof_ids) x;
 if pg_catalog.cardinality(v_proofs)<>pg_catalog.cardinality(p_proof_ids) then return public.order_error(400,'Select one to five distinct ready screenshots.'); end if;
 select o.* into v from public.orders o where o.id=p_order_id for update;
 if v.id is null or not coalesce(public.order_proof_player(v,v_actor),false) then return public.order_error(404,'Order not found.'); end if;
 if exists(select 1 from public.teammate_earning_entries where order_id=v.id) then
   select e.result into v_result from public.teammate_earning_entries e where e.order_id=v.id and e.teammate_id=v_actor and e.assignment_id=p_assignment_id and e.request_id=p_request_id and e.proof_ids=v_proofs;
   if found then return v_result; end if;
   return public.order_error(409,'Completion already recorded with another request or proof set.');
 end if;
 if exists(select 1 from public.teammate_earning_entries where teammate_id=v_actor and request_id=p_request_id) then return public.order_error(409,'Request UUID already bound to another completion.'); end if;
 if v.status<>'in_progress' or v.current_assignment_id<>p_assignment_id or not exists(select 1 from public.order_assignments where id=p_assignment_id and ended_at is null) then return public.order_error(409,'Assignment unavailable.'); end if;
 select p.* into pay from public.order_payments p where p.order_id=v.id for update;
 if pay.order_id is null or pay.state<>'captured' or pay.settle<>'none' then return public.order_error(409,'Captured settled payment required.'); end if;
 perform 1 from public.order_proof_uploads p where p.id=any(v_proofs) order by p.id for share;
 if (select pg_catalog.count(*) from public.order_proof_uploads p where p.id=any(v_proofs) and p.order_id=v.id and p.assignment_id=p_assignment_id and p.uploader_id=v_actor and p.state='ready')<>pg_catalog.cardinality(v_proofs) then return public.order_error(400,'Select ready screenshots from this assignment.'); end if;
 select pg_catalog.count(*) into v_count from public.teammate_earning_entries e
   join public.order_payments p on p.order_id=e.order_id
   where e.teammate_id=v_actor and p.state<>'refunded'
     and not exists(select 1 from public.stripe_disputes d where d.order_id=e.order_id);
 v_now:=pg_catalog.clock_timestamp(); v_trust:=public.completion_trust(v_count); v_percent:=(v_trust->>'deposit_percent')::integer;
 v_held:=(v.payout_usd_cents*v_percent+50)/100;
 v_result:=pg_catalog.jsonb_build_object('completion',pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',p_assignment_id,'request_id',p_request_id,'proof_ids',v_proofs,'completed_at',v_now,'payout_usd_cents',v.payout_usd_cents,'deposit_percent',v_percent,'held_usd_cents',v_held,'net_usd_cents',v.payout_usd_cents-v_held,'trust_tier',v_trust->>'trust_tier'));
 insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values(v.id,p_assignment_id,v_actor,p_request_id,v_proofs,v_now,v_count,v_trust->>'trust_tier',v.payout_usd_cents,v_percent,v_held,v.payout_usd_cents-v_held,pg_catalog.jsonb_build_object('payout_usd_cents',v.payout_usd_cents,'booking_fx',v.booking_fx,'payment_intent_id',pay.intent_id,'payment_state',pay.state,'payment_settle',pay.settle),v_result);
 insert into public.order_completion_proofs(order_id,proof_id) select v.id,x from pg_catalog.unnest(v_proofs) x;
 update public.order_assignments set ended_at=v_now,end_reason='completed' where id=p_assignment_id;
 update public.orders set status='completed',completed_at=v_now where id=v.id;
 return v_result;
end $$;

-- Latest definition is 20261024200000_leaderboard.sql. Trust totals now use release state and valid orders.
create or replace function public.teammate_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_count bigint; v_trust jsonb; v_result jsonb; v_next integer; v_floor integer;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate';
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 select pg_catalog.count(*) into v_count from public.teammate_earning_entries e join public.order_payments p on p.order_id=e.order_id
   where e.teammate_id=v_actor and p.state<>'refunded' and not exists(select 1 from public.stripe_disputes d where d.order_id=e.order_id);
 v_trust:=public.completion_trust(v_count);
 v_floor:=case when v_count>=1000 then 1000 when v_count>=500 then 500 when v_count>=250 then 250 when v_count>=100 then 100 else 0 end;
 v_next:=case when v_count<100 then 100 when v_count<250 then 250 when v_count<500 then 500 when v_count<1000 then 1000 end;
 select pg_catalog.jsonb_build_object(
   'now',(pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000)::bigint,'me',v_actor,
   'stats',pg_catalog.jsonb_build_object(
     'completed',v_count,'tier',pg_catalog.jsonb_build_object('name',pg_catalog.initcap(v_trust->>'trust_tier'),'deposit',(v_trust->>'deposit_percent')::integer),
     'held',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id where r.teammate_id=v_actor and r.state in ('waiting','blocked')),0)/100.0,
     'released',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id where r.teammate_id=v_actor and r.state='released'),0)/100.0,
     'forfeited',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases r join public.teammate_earning_entries e on e.order_id=r.earning_id where r.teammate_id=v_actor and r.state='forfeited'),0)/100.0,
     'saved',coalesce((select pg_catalog.sum((10-e.deposit_percent)*e.payout_usd_cents) from public.teammate_earning_entries e where e.teammate_id=v_actor),0)/10000.0,
     'progress',pg_catalog.jsonb_build_object('current',v_count,'next',v_next,'remaining',coalesce(v_next-v_count,0),'percent',case when v_next is null then 100 else pg_catalog.floor(100.0*(v_count-v_floor)/(v_next-v_floor))::integer end),
     'rating',(select pg_catalog.round(pg_catalog.avg(r.rating),2) from public.order_reviews r where r.teammate_id=v_actor),
     'reviews',(select pg_catalog.count(*) from public.order_reviews r where r.teammate_id=v_actor),'tipsTotal',0,
     'recent',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('orderId',e.order_id,'at',(pg_catalog.date_part('epoch',e.completed_at)*1000)::bigint,'net',e.net_usd_cents/100.0,'tip',0,'game',o.game) order by e.completed_at desc) from public.teammate_earning_entries e join public.orders o on o.id=e.order_id where e.teammate_id=v_actor and e.completed_at>pg_catalog.clock_timestamp()-interval '8 days'),'[]'::jsonb),
     'latestReviews',coalesce((select pg_catalog.jsonb_agg(q.item order by q.created_at desc) from (select r.created_at,pg_catalog.jsonb_build_object('rating',r.rating,'text',r.text,'tags',pg_catalog.to_jsonb(r.tags),'customer',o.customer_name,'game',o.game,'at',(pg_catalog.date_part('epoch',r.created_at)*1000)::bigint) item from public.order_reviews r join public.orders o on o.id=r.order_id where r.teammate_id=v_actor and (r.text<>'' or pg_catalog.cardinality(r.tags)>0) order by r.created_at desc,r.order_id limit 5) q),'[]'::jsonb),
     'adjustments','[]'::jsonb),
   'leaderboard',public.teammate_leaderboard(pg_catalog.clock_timestamp())) into v_result;
 return v_result;
end $$;
revoke all on function public.teammate_stats() from public,anon,authenticated,service_role;
grant execute on function public.teammate_stats() to authenticated;

commit;
