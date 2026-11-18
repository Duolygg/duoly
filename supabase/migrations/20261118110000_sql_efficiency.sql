-- Audited read-only SQL efficiency changes. CREATE OR REPLACE preserves ACLs.
-- Function statements are byte-for-byte copies of proposals 01, 02, 03, 06, 07, 09.

CREATE OR REPLACE FUNCTION public.admin_orders_page(p_limit integer DEFAULT 200, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists(select 1 from public.admin_caller_for('live', 'orders')) then return public.order_error(403,'Admins only.'); end if;
  if p_limit not between 1 and 500 or p_offset<0 then return public.order_error(400,'Invalid page.'); end if;
  return (with page as materialized (select * from public.orders order by created_at desc,id desc limit p_limit offset p_offset),
customer_keys as materialized (select distinct customer_id from page),
customer_work as materialized (
 select customer_id, (select pg_catalog.count(*) from public.orders co where co.customer_id=k.customer_id) order_count,
 public.loyalty_level(public.loyalty_valid_count(customer_id)) loyalty from customer_keys k),
teammate_keys as materialized (select distinct assigned_teammate_id teammate_id from page),
teammate_work as materialized (
 select teammate_id,public.completion_trust(public.payout_valid_count(teammate_id)) trust,
 (select pg_catalog.round(pg_catalog.avg(rv.rating),2) from public.order_reviews rv where rv.teammate_id=k.teammate_id) rating from teammate_keys k)
select pg_catalog.jsonb_build_object(
    'total',(select pg_catalog.count(*) from public.orders),
    'orders',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',o.public_reference,'orderId',o.id,'status',o.status,'game',o.game,'service',o.title,'units',o.units,'unit',o.unit,'gg',o.gg,
      'rank',o.rank,'region',o.region,'voice',o.voice,'amountCents',o.amount_eur_cents,'payoutUsdCents',o.payout_usd_cents,'fx',o.booking_fx,
      'createdAt',o.created_at,'queuedAt',o.queued_at,'acceptedAt',o.accepted_at,'completedAt',o.completed_at,'cancelledAt',o.cancelled_at,'cancelReason',o.cancel_reason,
      'adminCancelNote',o.admin_cancel_note,'adminRefundedAt',o.admin_refunded_at,'adminRefundReason',o.admin_refund_reason,
      'rerolls',o.rerolls,'customerId',o.customer_id,'customer',o.customer_name,'customerAv',o.customer_image,
      'customerOrderCount',cw.order_count,
      'customerLoyalty',cw.loyalty,
      'teammateId',o.assigned_teammate_id,'teammate',tp.name,'teammateAv',tp.image,
      'teammateRating',tw.rating,
      'teammateTrust',case when o.assigned_teammate_id is null then null else tw.trust end,
      'depositPercent',coalesce(ee.deposit_percent,(tw.trust->>'deposit_percent')::integer),
      'depositHeldUsdCents',coalesce(ee.held_usd_cents,case when o.assigned_teammate_id is null then null else (o.payout_usd_cents*(tw.trust->>'deposit_percent')::integer+50)/100 end),
      'teammateNetUsdCents',coalesce(ee.net_usd_cents,case when o.assigned_teammate_id is null then null else o.payout_usd_cents-(o.payout_usd_cents*(tw.trust->>'deposit_percent')::integer+50)/100 end),
      'cashbackPercent',coalesce(lc.cashback_percent,(cw.loyalty->>'cashback')::integer),
      'cashbackEurCents',coalesce(lc.amount_eur_cents,(public.loyalty_card_paid_cents(o.id)*coalesce(lc.cashback_percent,(cw.loyalty->>'cashback')::integer)+50)/100),
      'review',(select public.order_review_dto(r) from public.order_reviews r where r.order_id=o.id),
      'tip',(select public.tip_dto(t) from public.order_tips t where t.order_id=o.id),
      'payment',case when pay.order_id is null then null else pg_catalog.jsonb_build_object('method',pay.payment_method_type,'state',pay.state,'settle',pay.settle,'currency',pay.currency,'amountMinor',pay.amount_minor,'error',pay.last_error,'stripeId',pay.stripe_payment_intent_id,'refundReason',pay.refund_reason,'refundedAt',pay.refunded_at) end,
      'refundCents',(select pg_catalog.sum(c.amount_eur_cents) from public.refund_credits c where c.order_id=o.id)) order by o.created_at desc)
      from page o
      left join customer_work cw on cw.customer_id=o.customer_id
      left join teammate_work tw on tw.teammate_id is not distinct from o.assigned_teammate_id
      left join public.profiles tp on tp.id=o.assigned_teammate_id left join public.order_payments pay on pay.order_id=o.id
      left join public.teammate_earning_entries ee on ee.order_id=o.id left join public.loyalty_cashbacks lc on lc.order_id=o.id),'[]'::jsonb)));
end $function$
;

CREATE OR REPLACE FUNCTION public.customer_favorite_slugs()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(pg_catalog.jsonb_agg(p.slug order by f.created_at desc), '[]'::jsonb)
  from public.customer_favorites f
  join public.teammate_public_profiles p on p.user_id = f.teammate_id
  where f.customer_id = auth.uid()
    and exists(select 1 from public.account_roles r where r.user_id = auth.uid() and r.role = 'customer')
    -- Only pages a visitor can actually open, the same test the profile route applies.
    and p.published and not p.admin_hidden
    and public.teammate_public_active(p.user_id)
    and public.teammate_public_approved(p.user_id,p.featured_game);
$function$
;

CREATE OR REPLACE FUNCTION public.public_teammate_indexable()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slug', p.slug, 'updatedAt', p.updated_at) order by p.slug), '[]'::jsonb)
  from public.teammate_public_profiles p join public.profiles pr on pr.id = p.user_id join public.account_roles ar on ar.user_id=p.user_id join public.teammate_order_access a on a.user_id=p.user_id join auth.users u on u.id=p.user_id
  where p.published and not p.admin_hidden and ar.role='teammate' and not a.suspended and (u.banned_until is null or u.banned_until<=pg_catalog.now()) and u.deleted_at is null
    and (p.featured_game=any(a.approved_games) or (p.featured_game='social' and a.gg_access))
    and (exists(select 1 from public.teammate_game_ranks r where r.user_id = p.user_id and r.verified_at is not null
          and r.rank is not null and (r.game=any(a.approved_games) or (r.game='social' and a.gg_access)))
      or (public.teammate_public_bio_valid(pr.bio) and pg_catalog.char_length(pg_catalog.btrim(coalesce(pr.bio, ''))) >= 60)
      or public.payout_valid_count(p.user_id) >= 5);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_accounts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid;
begin
  select id into v_actor from public.admin_caller_for('users');
  if v_actor is null then return public.order_error(403, 'Admins only.'); end if;
  return pg_catalog.jsonb_build_object('accounts', coalesce((
    select pg_catalog.jsonb_agg(x.item order by x.created_at) from (select u.created_at,pg_catalog.jsonb_build_object(
    'id', u.id,
    'name', coalesce(p.name, ''),
    'email', coalesce(u.email, ''),
    'image', coalesce(p.image, ''),
    'country', coalesce(p.country, ''),
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    'role', r.role,
    'owner', r.owner,
    'you', u.id = v_actor,
    'roleBy', coalesce((select coalesce(nullif(bp.name, 'Player'), bu.email) from auth.users as bu
                        left join public.profiles as bp on bp.id = bu.id where bu.id = r.role_set_by), ''),
    'roleAt', r.role_set_at,
    'firstSeen', u.created_at,
    'lastSeen', u.last_sign_in_at,
    'discord', (select d.username from public.discord_accounts as d where d.user_id = u.id),
    'access', case when a.user_id is null then pg_catalog.jsonb_build_object('games', '[]'::jsonb, 'gg', false, 'suspended', false, 'stream', '[]'::jsonb)
      else pg_catalog.jsonb_build_object('games', pg_catalog.to_jsonb(a.approved_games), 'gg', a.gg_access, 'suspended', a.suspended,
        'stream', pg_catalog.to_jsonb(public.streamer_games(a))) end,
    'permissions', case when r.role = 'admin' then pg_catalog.to_jsonb(public.admin_sections_of(u.id)) end,
    'busy', exists (select 1 from public.orders as o where o.assigned_teammate_id = u.id and o.status = 'in_progress')) item
  from auth.users as u
  join public.account_roles as r on r.user_id = u.id
  left join public.profiles as p on p.id = u.id
  left join public.teammate_order_access as a on a.user_id = u.id) x), '[]'::jsonb));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.loyalty_valid_count(p_customer uuid, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select pg_catalog.count(*) from public.orders o
   where o.customer_id=p_customer and o.status='completed'
     and (p_before_at is null or (o.completed_at,o.id)<(p_before_at,p_before_id))
     and o.admin_refunded_at is null
     and not exists(select 1 from public.order_payments p where p.order_id=o.id and p.state='refunded')
     and not exists(select 1 from public.wallet_entries e where e.order_id=o.id and e.kind='refund')
     and not exists(select 1 from public.free_coaching_claims f where f.order_id=o.id)
$function$
;

CREATE OR REPLACE FUNCTION public.admin_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
  select pg_catalog.jsonb_build_object(
    'owner',r.owner,
    'sections',pg_catalog.to_jsonb(case when r.owner then public.admin_section_ids()
      else coalesce(p.sections,public.admin_default_sections()) end))
    into v_result
    from public.account_roles r
    join auth.users u on u.id=r.user_id
    left join public.admin_permissions p on p.user_id=r.user_id
    where r.user_id=(select auth.uid()) and r.role='admin';
  if not found then return public.order_error(403, 'Admins only.'); end if;
  return v_result;
end $function$;
