-- ACTIVATION GATE: applying grants enables customer review writes and review reads.
-- Tips remain disabled and are not stored by this migration.
-- Depends on 20261024142000_presence.sql (feat/presence): admin_teammates starts from that version.
begin;

alter table public.order_chat_messages drop constraint order_chat_messages_system_event_check;
alter table public.order_chat_messages add constraint order_chat_messages_system_event_check
  check (system_event in ('accepted','completed','reviewed'));

create table public.order_reviews (
  order_id uuid primary key references public.teammate_earning_entries(order_id) on delete restrict,
  assignment_id uuid not null,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  text text not null default '' check (pg_catalog.char_length(text) <= 500),
  tags text[] not null default '{}' check (
    pg_catalog.cardinality(tags) <= 4
    and pg_catalog.array_position(tags,null) is null
    and tags <@ array['Great comms','Shotcaller','Super friendly','Taught me a lot','Carried hard','Patient','Fun to play with']::text[]
  ),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key (assignment_id,order_id,teammate_id)
    references public.order_assignments(id,order_id,teammate_id) on delete restrict
);
create index order_reviews_teammate_latest on public.order_reviews(teammate_id,created_at desc,order_id);
alter table public.order_reviews enable row level security;
revoke all on table public.order_reviews from public,anon,authenticated,service_role;
create trigger order_reviews_immutable before update or delete on public.order_reviews
  for each row execute function public.completion_immutable_guard();

create function public.order_review_dto(p_review public.order_reviews) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'rating',p_review.rating,
    'text',p_review.text,
    'tags',pg_catalog.to_jsonb(p_review.tags),
    'at',p_review.created_at);
$$;
revoke all on function public.order_review_dto(public.order_reviews) from public,anon,authenticated,service_role;

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
    'teammate', (select pg_catalog.jsonb_build_object('name', p.name, 'image', p.image, 'country', p.country)
      from public.profiles as p where p.id = p_order.assigned_teammate_id),
    'review', (select public.order_review_dto(r) from public.order_reviews as r where r.order_id=p_order.id));
$$;

create function public.order_review(p_order_id uuid,p_rating integer,p_text text default '',p_tags text[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v public.orders; a public.order_assignments; r public.order_reviews;
 v_text text; v_tags text[];
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='customer' for share;
 if not found then return public.order_error(403,'Customer role required.'); end if;
 select o.* into v from public.orders as o where o.id=p_order_id and o.customer_id=v_actor for update;
 if v.id is null then return public.order_error(404,'Order not found.'); end if;
 if v.status <> 'completed' then return public.order_error(409,'You can rate your teammate once the order is done.'); end if;
 if exists(select 1 from public.order_reviews where order_id=v.id) then
   return public.order_error(409,'You already rated this order. Thank you!');
 end if;
 if p_rating is null or p_rating not between 1 and 5 then return public.order_error(400,'Pick 1 to 5 stars.'); end if;
 v_text := pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_text,''),'[[:cntrl:]]',' ','g')),500);
 -- lib/orders.js:287 keeps only known tags and the first four; unknown values are dropped, not refused.
 select coalesce(pg_catalog.array_agg(q.tag order by q.n),'{}') into v_tags from (
   select t.tag,pg_catalog.min(t.n) as n from pg_catalog.unnest(coalesce(p_tags,'{}'::text[])) with ordinality as t(tag,n)
   where t.tag = any(array['Great comms','Shotcaller','Super friendly','Taught me a lot','Carried hard','Patient','Fun to play with']::text[])
   group by t.tag order by n limit 4) as q;
 select x.* into a from public.order_assignments as x where x.id=v.current_assignment_id
   and x.order_id=v.id and x.teammate_id=v.assigned_teammate_id
   and x.end_reason='completed' and x.ended_at is not null for share;
 if a.id is null or not exists(select 1 from public.teammate_earning_entries as e
   where e.order_id=v.id and e.assignment_id=a.id and e.teammate_id=a.teammate_id) then
   return public.order_error(409,'Completed assignment unavailable.');
 end if;
 insert into public.order_reviews(order_id,assignment_id,customer_id,teammate_id,rating,text,tags)
 values(v.id,a.id,v_actor,a.teammate_id,p_rating,v_text,v_tags) returning * into r;
 if exists(select 1 from public.order_chat_rooms where assignment_id=a.id) then
   perform public.order_chat_append(a.id,'system','Duoly','','Rated '||p_rating::text||'/5. Thank you!',null,'reviewed');
   perform public.order_chat_invalidate(a.id);
 end if;
 return pg_catalog.jsonb_build_object('order',public.order_customer_dto(v));
end $$;
revoke all on function public.order_review(uuid,integer,text,text[]) from public,anon,authenticated,service_role;
grant execute on function public.order_review(uuid,integer,text,text[]) to authenticated;

create function public.teammate_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_count bigint; v_trust jsonb; v_result jsonb;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 perform 1 from public.account_roles where user_id=v_actor and role='teammate';
 if not found then return public.order_error(403,'Teammate role required.'); end if;
 select pg_catalog.count(*) into v_count from public.teammate_earning_entries where teammate_id=v_actor;
 v_trust := public.completion_trust(v_count);
 select pg_catalog.jsonb_build_object(
   'now',(pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000)::bigint,
   'me',v_actor,
   'stats',pg_catalog.jsonb_build_object(
     'completed',v_count,
     'tier',pg_catalog.jsonb_build_object('name',pg_catalog.initcap(v_trust->>'trust_tier'),'deposit',(v_trust->>'deposit_percent')::integer),
     'held',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.teammate_earning_entries as e
       where e.teammate_id=v_actor and e.completed_at > pg_catalog.clock_timestamp()-interval '14 days'),0)/100.0,
     'saved',coalesce((select pg_catalog.sum((10-e.deposit_percent)*e.payout_usd_cents) from public.teammate_earning_entries as e where e.teammate_id=v_actor),0)/10000.0,
     'rating',(select pg_catalog.round(pg_catalog.avg(r.rating),2) from public.order_reviews as r where r.teammate_id=v_actor),
     'reviews',(select pg_catalog.count(*) from public.order_reviews as r where r.teammate_id=v_actor),
     'tipsTotal',0,
     'recent',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'orderId',e.order_id,'at',(pg_catalog.date_part('epoch',e.completed_at)*1000)::bigint,
       'net',e.net_usd_cents/100.0,'tip',0,'game',o.game) order by e.completed_at desc)
       from public.teammate_earning_entries as e join public.orders as o on o.id=e.order_id
       where e.teammate_id=v_actor and e.completed_at > pg_catalog.clock_timestamp()-interval '8 days'),'[]'::jsonb),
     'latestReviews',coalesce((select pg_catalog.jsonb_agg(q.item order by q.created_at desc) from (
       select r.created_at,pg_catalog.jsonb_build_object('rating',r.rating,'text',r.text,'tags',pg_catalog.to_jsonb(r.tags),
         'customer',o.customer_name,'game',o.game,'at',(pg_catalog.date_part('epoch',r.created_at)*1000)::bigint) as item
       from public.order_reviews as r join public.orders as o on o.id=r.order_id
       where r.teammate_id=v_actor and (r.text<>'' or pg_catalog.cardinality(r.tags)>0)
       order by r.created_at desc,r.order_id limit 5) as q),'[]'::jsonb),
     'adjustments','[]'::jsonb),
   'leaderboard','{}'::jsonb) into v_result;
 return v_result;
end $$;
revoke all on function public.teammate_stats() from public,anon,authenticated,service_role;
grant execute on function public.teammate_stats() to authenticated;

-- Based on the 20261024142000_presence.sql version (applied first). Only rating and reviews are added.
create or replace function public.admin_teammates() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('teammates',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',r.user_id,'name',coalesce(nullif(p.name,'Player'),u.email,''),'email',coalesce(u.email,''),'image',coalesce(p.image,''),'country',coalesce(p.country,''),
    'joined',coalesce(r.role_set_at,u.created_at),'lastSeen',u.last_sign_in_at,'games',pg_catalog.to_jsonb(coalesce(a.approved_games,'{}')),'gg',coalesce(a.gg_access,false),'discord',d.username,
    'suspended',case when coalesce(a.suspended,false) then pg_catalog.jsonb_build_object('reason',a.suspended_reason,'at',a.suspended_at,'by',coalesce((select coalesce(nullif(bp.name,'Player'),bu.email) from auth.users bu left join public.profiles bp on bp.id=bu.id where bu.id=a.suspended_by),'')) end,
    'online',exists(select 1 from public.teammate_presence tp where tp.user_id=r.user_id and tp.online and tp.last_seen_at > pg_catalog.clock_timestamp()-interval '20 seconds') or exists(select 1 from public.orders o where o.assigned_teammate_id=r.user_id and o.status='in_progress'),
    'playing',exists(select 1 from public.orders o where o.assigned_teammate_id=r.user_id and o.status='in_progress'),
    'completed',(select pg_catalog.count(*) from public.orders o where o.assigned_teammate_id=r.user_id and o.status='completed'),
    'accepted',(select pg_catalog.count(*) from public.order_assignments h where h.teammate_id=r.user_id),
    'earned30UsdCents',coalesce((select pg_catalog.sum(o.payout_usd_cents) from public.orders o where o.assigned_teammate_id=r.user_id and o.status='completed' and o.completed_at > pg_catalog.clock_timestamp()-interval '30 days'),0),
    'rating',(select pg_catalog.round(pg_catalog.avg(rv.rating),2) from public.order_reviews rv where rv.teammate_id=r.user_id),
    'reviews',(select pg_catalog.count(*) from public.order_reviews rv where rv.teammate_id=r.user_id),
    'warnings',(select pg_catalog.count(*) from public.order_chat_flags f where f.actor_id=r.user_id and f.status='warned')) order by coalesce(r.role_set_at,u.created_at) desc)
    from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
    left join public.teammate_order_access a on a.user_id=r.user_id left join public.discord_accounts d on d.user_id=r.user_id where r.role='teammate'),'[]'::jsonb));
end;
$$;

create or replace function public.admin_orders(p_limit integer default 500) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
 return pg_catalog.jsonb_build_object('orders',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'id',o.public_reference,'orderId',o.id,'status',o.status,'game',o.game,'service',o.title,'units',o.units,'unit',o.unit,'gg',o.gg,
   'rank',o.rank,'region',o.region,'voice',o.voice,'amountCents',o.amount_eur_cents,'payoutUsdCents',o.payout_usd_cents,'fx',o.booking_fx,
   'createdAt',o.created_at,'queuedAt',o.queued_at,'acceptedAt',o.accepted_at,'completedAt',o.completed_at,
   'cancelledAt',o.cancelled_at,'cancelReason',o.cancel_reason,'rerolls',o.rerolls,'customerId',o.customer_id,
   'customer',o.customer_name,'customerAv',o.customer_image,'teammateId',o.assigned_teammate_id,'teammate',tp.name,'teammateAv',tp.image,
   'review',(select public.order_review_dto(r) from public.order_reviews as r where r.order_id=o.id),
   'payment',case when pay.order_id is null then null else pg_catalog.jsonb_build_object('method',pay.payment_method_type,'state',pay.state,
     'settle',pay.settle,'currency',pay.currency,'amountMinor',pay.amount_minor,'error',pay.last_error,'stripeId',pay.stripe_payment_intent_id) end,
   'refundCents',(select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits as c where c.order_id=o.id)) order by o.created_at desc)
   from (select * from public.orders order by created_at desc limit greatest(1,least(coalesce(p_limit,500),2000))) as o
   left join public.profiles as tp on tp.id=o.assigned_teammate_id left join public.order_payments as pay on pay.order_id=o.id),'[]'::jsonb));
end $$;

commit;
