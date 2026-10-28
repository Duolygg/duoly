-- Admin parity: complete roster, order, support, overview and leaderboard read models.
-- Additive frontend code is deployed before this migration; old RPC overloads remain available.
begin;

alter table public.support_conversations
  add column discord_channel_id text,
  add column discord_message_id text,
  add column discord_message_text text;

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
    'warnings',(select pg_catalog.count(*) from public.order_chat_flags f where f.actor_id=r.user_id and f.status='warned'),
    'trust',public.completion_trust(public.payout_valid_count(r.user_id)),
    'depositHeldUsdCents',coalesce((select pg_catalog.sum(e.held_usd_cents) from public.deposit_releases dr join public.teammate_earning_entries e on e.order_id=dr.earning_id where dr.teammate_id=r.user_id and dr.state in ('waiting','blocked')),0),
    'payout',public.teammate_payout_summary(r.user_id)) order by coalesce(r.role_set_at,u.created_at) desc)
    from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
    left join public.teammate_order_access a on a.user_id=r.user_id left join public.discord_accounts d on d.user_id=r.user_id where r.role='teammate'),'[]'::jsonb));
end;
$$;

create function public.admin_orders_page(p_limit integer default 200,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
  if p_limit not between 1 and 500 or p_offset<0 then return public.order_error(400,'Invalid page.'); end if;
  return pg_catalog.jsonb_build_object(
    'total',(select pg_catalog.count(*) from public.orders),
    'orders',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',o.public_reference,'orderId',o.id,'status',o.status,'game',o.game,'service',o.title,'units',o.units,'unit',o.unit,'gg',o.gg,
      'rank',o.rank,'region',o.region,'voice',o.voice,'amountCents',o.amount_eur_cents,'payoutUsdCents',o.payout_usd_cents,'fx',o.booking_fx,
      'createdAt',o.created_at,'queuedAt',o.queued_at,'acceptedAt',o.accepted_at,'completedAt',o.completed_at,'cancelledAt',o.cancelled_at,'cancelReason',o.cancel_reason,
      'adminCancelNote',o.admin_cancel_note,'adminRefundedAt',o.admin_refunded_at,'adminRefundReason',o.admin_refund_reason,
      'rerolls',o.rerolls,'customerId',o.customer_id,'customer',o.customer_name,'customerAv',o.customer_image,
      'customerOrderCount',(select pg_catalog.count(*) from public.orders co where co.customer_id=o.customer_id),
      'customerLoyalty',public.loyalty_level(public.loyalty_valid_count(o.customer_id)),
      'teammateId',o.assigned_teammate_id,'teammate',tp.name,'teammateAv',tp.image,
      'teammateRating',(select pg_catalog.round(pg_catalog.avg(rv.rating),2) from public.order_reviews rv where rv.teammate_id=o.assigned_teammate_id),
      'teammateTrust',case when o.assigned_teammate_id is null then null else public.completion_trust(public.payout_valid_count(o.assigned_teammate_id)) end,
      'depositPercent',coalesce(ee.deposit_percent,(public.completion_trust(public.payout_valid_count(o.assigned_teammate_id))->>'deposit_percent')::integer),
      'depositHeldUsdCents',coalesce(ee.held_usd_cents,case when o.assigned_teammate_id is null then null else (o.payout_usd_cents*(public.completion_trust(public.payout_valid_count(o.assigned_teammate_id))->>'deposit_percent')::integer+50)/100 end),
      'teammateNetUsdCents',coalesce(ee.net_usd_cents,case when o.assigned_teammate_id is null then null else o.payout_usd_cents-(o.payout_usd_cents*(public.completion_trust(public.payout_valid_count(o.assigned_teammate_id))->>'deposit_percent')::integer+50)/100 end),
      'cashbackPercent',coalesce(lc.cashback_percent,(public.loyalty_level(public.loyalty_valid_count(o.customer_id))->>'cashback')::integer),
      'cashbackEurCents',coalesce(lc.amount_eur_cents,(public.loyalty_card_paid_cents(o.id)*coalesce(lc.cashback_percent,(public.loyalty_level(public.loyalty_valid_count(o.customer_id))->>'cashback')::integer)+50)/100),
      'review',(select public.order_review_dto(r) from public.order_reviews r where r.order_id=o.id),
      'tip',(select public.tip_dto(t) from public.order_tips t where t.order_id=o.id),
      'payment',case when pay.order_id is null then null else pg_catalog.jsonb_build_object('method',pay.payment_method_type,'state',pay.state,'settle',pay.settle,'currency',pay.currency,'amountMinor',pay.amount_minor,'error',pay.last_error,'stripeId',pay.stripe_payment_intent_id,'refundReason',pay.refund_reason,'refundedAt',pay.refunded_at) end,
      'refundCents',(select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits c where c.order_id=o.id)) order by o.created_at desc)
      from (select * from public.orders order by created_at desc,id desc limit p_limit offset p_offset) o
      left join public.profiles tp on tp.id=o.assigned_teammate_id left join public.order_payments pay on pay.order_id=o.id
      left join public.teammate_earning_entries ee on ee.order_id=o.id left join public.loyalty_cashbacks lc on lc.order_id=o.id),'[]'::jsonb));
end $$;
revoke all on function public.admin_orders_page(integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_orders_page(integer,integer) to authenticated;

create function public.admin_applications_page(p_limit integer default 200,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
  if p_limit not between 1 and 500 or p_offset<0 then return public.order_error(400,'Invalid page.'); end if;
  return pg_catalog.jsonb_build_object('total',(select pg_catalog.count(*) from public.teammate_applications),
    'applications',coalesce((select pg_catalog.jsonb_agg(public.admin_application_dto(a) order by a.submitted_at desc)
      from (select * from public.teammate_applications order by submitted_at desc,id desc limit p_limit offset p_offset) a),'[]'::jsonb));
end $$;
revoke all on function public.admin_applications_page(integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_applications_page(integer,integer) to authenticated;

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_now timestamptz:=pg_catalog.clock_timestamp(); v_start timestamptz:=public.payout_week_start(v_now); v_due bigint; v_count bigint;
begin
  if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
  with amounts as (
    select l.teammate_id,public.payout_line_total(l.id) amount from public.payout_lines l where l.status in ('scheduled','on_hold')
    union all
    select r.user_id,((p->>'net')::bigint+(p->>'tips')::bigint+(p->>'released')::bigint+(p->>'adjust')::bigint+(p->>'holdReleased')::bigint+(p->>'carried')::bigint-(p->>'autoHeld')::bigint)
    from public.account_roles r cross join lateral public.payout_pending(r.user_id,v_now) p where r.role='teammate' and (p->>'active')::boolean
  ), totals as (select teammate_id,pg_catalog.sum(amount) amount from amounts group by teammate_id)
  select pg_catalog.count(*) filter(where amount>0),coalesce(pg_catalog.sum(greatest(amount,0)),0) into v_count,v_due from totals;
  return pg_catalog.jsonb_build_object(
    'reportsOpen',(select pg_catalog.count(*) from public.order_reports where status='open'),
    'queuedOrders',(select pg_catalog.count(*) from public.orders where status='queued'),
    'activeOrders',(select pg_catalog.count(*) from public.orders where status in ('queued','in_progress')),
    'pendingApplications',(select pg_catalog.count(*) from public.teammate_applications where status='pending'),
    'payoutsDue',v_count,'payoutsDueUsdCents',v_due,
    'payoutDueAt',public.payout_week_end(v_start));
end $$;
revoke all on function public.admin_overview() from public,anon,authenticated,service_role;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_support_inbox(p_conversation_id uuid default null::uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_open jsonb;
begin
  if not exists (select 1 from public.admin_caller()) then return public.order_error(403, 'Admins only.'); end if;
  if p_conversation_id is not null then
    select pg_catalog.jsonb_build_object(
      'id', c.id, 'reference', c.reference, 'role', c.role, 'name', c.name, 'email', c.email, 'image', c.image,
      'status', c.status, 'agent', case when c.claimed_by is null then null else pg_catalog.jsonb_build_object('id', c.claimed_by, 'name', coalesce(nullif(p.name, 'Player'), u.email, 'Admin'), 'image', coalesce(p.image, '')) end,
      'updatedAt', c.updated_at, 'waitingSince', c.waiting_since,
      'discordNote',case when c.discord_message_id is null then null else pg_catalog.jsonb_build_object('channelId',c.discord_channel_id,'messageId',c.discord_message_id,'text',c.discord_message_text) end,
      'unread', case when c.status in ('waiting','human') then (select pg_catalog.count(*) from public.support_messages m where m.conversation_id = c.id and m.sender = 'user' and m.created_at > coalesce(c.admin_seen_at, '-infinity')) else 0 end,
      'messages', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', m.id, 'from', m.sender, 'text', m.body, 'at', m.created_at,'by', case when m.sender = 'admin' then pg_catalog.jsonb_build_object('name', m.admin_name, 'image', m.admin_image) end) order by m.created_at, m.id) from public.support_messages m where m.conversation_id = c.id), '[]'::jsonb),
      'context', case when c.role = 'customer' then pg_catalog.jsonb_build_object('kind','customer','orders',(select pg_catalog.count(*) from public.orders o where o.customer_id = c.user_id),
        'wallet',coalesce((select greatest(w.total_eur_cents,0) from public.wallet_balances w where w.customer_id=c.user_id),0)/100.0,
        'level',(public.loyalty_level(public.loyalty_valid_count(c.user_id))->>'name'),'blocked',exists(select 1 from public.customer_blocks b where b.user_id=c.user_id),
        'order',(select pg_catalog.jsonb_build_object('id',o.public_reference,'status',o.status,'title',o.title,'units',o.units,'game',o.game) from public.orders o where o.customer_id=c.user_id and o.status in ('queued','in_progress') order by o.created_at desc limit 1))
        when c.role = 'teammate' then pg_catalog.jsonb_build_object('kind','teammate','games',pg_catalog.to_jsonb(coalesce(a.approved_games,'{}')),'gg',coalesce(a.gg_access,false),'suspended',coalesce(a.suspended,false),'discord',d.user_id is not null,
          'lifetime',(select pg_catalog.count(*) from public.teammate_earning_entries e where e.teammate_id=c.user_id),'tier',pg_catalog.initcap(public.completion_trust(public.payout_valid_count(c.user_id))->>'trust_tier'),
          'rating',(select pg_catalog.round(pg_catalog.avg(rv.rating),2) from public.order_reviews rv where rv.teammate_id=c.user_id),
          'owed',coalesce((public.teammate_payout_summary(c.user_id)->>'due')::numeric,0)+coalesce((public.teammate_payout_summary(c.user_id)->>'owed')::numeric,0),
          'status',case when exists(select 1 from public.orders o where o.assigned_teammate_id=c.user_id and o.status='in_progress') then 'playing' when exists(select 1 from public.teammate_presence tp where tp.user_id=c.user_id and tp.online and tp.last_seen_at>pg_catalog.clock_timestamp()-interval '20 seconds') then 'online' else 'offline' end)
        end)
      into v_open from public.support_conversations c left join auth.users u on u.id = c.claimed_by left join public.profiles p on p.id = c.claimed_by
      left join public.teammate_order_access a on a.user_id = c.user_id left join public.discord_accounts d on d.user_id = c.user_id where c.id = p_conversation_id;
  end if;
  return pg_catalog.jsonb_build_object('conversations', coalesce((select pg_catalog.jsonb_agg(x order by (x->>'updatedAt') desc) from (
    select pg_catalog.jsonb_build_object('id',c.id,'reference',c.reference,'role',c.role,'name',c.name,'email',c.email,'image',c.image,'status',c.status,
      'updatedAt',c.updated_at,'waitingSince',case when c.status='waiting' then c.waiting_since end,
      'count',(select pg_catalog.count(*) from public.support_messages m where m.conversation_id=c.id),
      'lastUserText',coalesce((select m.body from public.support_messages m where m.conversation_id=c.id and m.sender='user' order by m.created_at desc,m.id desc limit 1),''),
      'preview',coalesce((select (case when m.sender='admin' then coalesce(nullif(m.admin_name,''),'Admin') || ': ' when m.sender='bot' then 'Sparky: ' else '' end) || pg_catalog.left(m.body,90) from public.support_messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1),''),
      'unread',case when c.status in ('waiting','human') then (select pg_catalog.count(*) from public.support_messages m where m.conversation_id=c.id and m.sender='user' and m.created_at>coalesce(c.admin_seen_at,'-infinity')) else 0 end) x
      from public.support_conversations c order by c.updated_at desc limit 200) q), '[]'::jsonb), 'open', v_open);
end;
$$;

create or replace function public.teammate_leaderboard(p_now timestamptz) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with periods(period, since) as (values ('week',p_now-interval '7 days'),('month',p_now-interval '30 days'),('all','-infinity'::timestamptz)),
  entries as (select e.teammate_id,e.completed_at,o.game,r.rating from public.teammate_earning_entries e join public.orders o on o.id=e.order_id join public.account_roles ar on ar.user_id=e.teammate_id and ar.role='teammate' left join public.order_reviews r on r.order_id=e.order_id where e.completed_at<=p_now),
  scoped as (select p.period,t.tab,x.teammate_id,x.completed_at,x.game,x.rating from periods p join entries x on x.completed_at>=p.since cross join lateral(values('global'),(x.game))t(tab)),
  per_game as (select period,tab,teammate_id,game,pg_catalog.count(*) n,pg_catalog.max(completed_at) last_at from scoped group by period,tab,teammate_id,game),
  main as (select distinct on(period,tab,teammate_id) period,tab,teammate_id,game from per_game order by period,tab,teammate_id,n desc,last_at desc,game),
  agg as (select period,tab,teammate_id,pg_catalog.count(*) orders,pg_catalog.round(pg_catalog.avg(rating),2) rating,pg_catalog.count(*) filter(where rating=5) fives from scoped group by period,tab,teammate_id),
  board as (select a.period,a.tab,pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',a.teammate_id,'name',coalesce(nullif(pg_catalog.btrim(p.name),''),'Teammate'),'image',coalesce(p.image,''),'country',coalesce(p.country,''),'orders',a.orders,'main',m.game,'rating',a.rating,'fives',a.fives,'points',a.orders*10+a.fives*5) order by a.orders*10+a.fives*5 desc,a.orders desc,a.teammate_id) list from agg a join main m on m.period=a.period and m.tab=a.tab and m.teammate_id=a.teammate_id left join public.profiles p on p.id=a.teammate_id group by a.period,a.tab)
  select pg_catalog.jsonb_object_agg(p.period,pg_catalog.jsonb_build_object('global','[]'::jsonb)||coalesce((select pg_catalog.jsonb_object_agg(b.tab,b.list) from board b where b.period=p.period),'{}'::jsonb)) from periods p;
$$;

revoke all on function public.admin_teammates(),public.admin_support_inbox(uuid),public.teammate_leaderboard(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.admin_teammates(),public.admin_support_inbox(uuid) to authenticated;

commit;
