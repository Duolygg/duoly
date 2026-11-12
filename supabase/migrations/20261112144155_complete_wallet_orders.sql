-- Wallet-paid orders can be completed (owner 2026-11-12, DL-93402).
--
-- Since wallet checkout (20261025260000) an order the Duoly balance pays in full has no
-- order_payments row: create_paid_order skips it for p_state 'wallet' and writes checkout_spend
-- entries instead. complete_order still required a captured Stripe payment (or a free perk), so a
-- teammate could never finish one of these orders: the desk showed "Completion conflicts with the
-- current assignment or proof" for the 409 'Captured settled payment required.'
--
-- complete_order is its live definition (20261106190000_team_orders) with one change: the payment
-- check also accepts a pay order the wallet covered in full, that no admin refunded, and whose
-- checkout_spend entries (none given back) add up to that wallet amount. Card orders, partly
-- wallet-paid orders (they keep their card row) and free perks are checked exactly as before.
-- It also refuses a screenshot that was removed (20261112153802 lets teammates remove their own;
-- admins could already). Teammate pay is unchanged: payout_usd_cents already comes from the full
-- order price.
begin;

-- The pay order (the lead's order for team seats) was paid in full from the Duoly balance.
create function public.order_wallet_paid(p_order_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(
    select 1 from public.orders o
    where o.id = p_order_id
      and o.wallet_eur_cents > 0
      and o.wallet_eur_cents = o.amount_eur_cents
      and o.admin_refunded_at is null
      and not exists(select 1 from public.order_payments p where p.order_id = o.id)
      and (select coalesce(-pg_catalog.sum(w.amount_eur_cents), 0) from public.wallet_entries w
           where w.order_id = o.id and w.kind = 'checkout_spend'
             and not exists(select 1 from public.wallet_entries r where r.reverses_id = w.id))
          = o.wallet_eur_cents);
$$;
revoke all on function public.order_wallet_paid(uuid) from public, anon, authenticated, service_role;

create or replace function public.complete_order(p_order_id uuid, p_assignment_id uuid, p_proof_ids uuid[], p_request_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_actor uuid := auth.uid(); v public.orders; pay public.order_payments;
 v_proofs uuid[]; v_count bigint; v_now timestamptz; v_held integer; v_result jsonb; v_trust jsonb; v_percent integer;
 v_pay_order uuid;
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
 if v.team_id is not null and not exists(select 1 from public.order_teams t where t.id=v.team_id and t.started_at is not null) then
   return public.order_error(409,'Your team starts once every seat is taken.');
 end if;
 -- Win/loss orders (20261102160000): the match report first.
 if public.order_tracks_wl(v) and not exists(select 1 from public.order_match_reports r where r.assignment_id=p_assignment_id) then
   return public.order_error(409,'Fill in the match report first: every game with both IGNs and the match link, plus your wins and losses.');
 end if;
 v_pay_order := coalesce((select t.lead_order_id from public.order_teams t where t.id=v.team_id), v.id);
 select p.* into pay from public.order_payments p where p.order_id=v_pay_order for update;
 -- (this migration) or the Duoly balance paid the whole order
 if not (pay.order_id is null and public.order_is_free_perk(v.id))
    and not (pay.order_id is null and public.order_wallet_paid(v_pay_order))
    and (pay.order_id is null or pay.state<>'captured' or pay.settle<>'none') then return public.order_error(409,'Captured settled payment required.'); end if;
 perform 1 from public.order_proof_uploads p where p.id=any(v_proofs) order by p.id for share;
 if (select pg_catalog.count(*) from public.order_proof_uploads p where p.id=any(v_proofs) and p.order_id=v.id and p.assignment_id=p_assignment_id and p.uploader_id=v_actor and p.state='ready'
   and not exists(select 1 from public.order_proof_removals x where x.proof_id=p.id))<>pg_catalog.cardinality(v_proofs) then return public.order_error(400,'Select ready screenshots from this assignment.'); end if;
 v_count := public.payout_valid_count(v_actor);
 v_now:=pg_catalog.clock_timestamp(); v_trust:=public.completion_trust(v_count); v_percent:=(v_trust->>'deposit_percent')::integer;
 v_held:=(v.payout_usd_cents*v_percent+50)/100;
 v_result:=pg_catalog.jsonb_build_object('completion',pg_catalog.jsonb_build_object('order_id',v.id,'assignment_id',p_assignment_id,'request_id',p_request_id,'proof_ids',v_proofs,'completed_at',v_now,'payout_usd_cents',v.payout_usd_cents,'deposit_percent',v_percent,'held_usd_cents',v_held,'net_usd_cents',v.payout_usd_cents-v_held,'trust_tier',v_trust->>'trust_tier'));
 insert into public.teammate_earning_entries(order_id,assignment_id,teammate_id,request_id,proof_ids,completed_at,prior_completed_count,trust_tier,payout_usd_cents,deposit_percent,held_usd_cents,net_usd_cents,source_snapshot,result)
 values(v.id,p_assignment_id,v_actor,p_request_id,v_proofs,v_now,v_count,v_trust->>'trust_tier',v.payout_usd_cents,v_percent,v_held,v.payout_usd_cents-v_held,pg_catalog.jsonb_build_object('payout_usd_cents',v.payout_usd_cents,'booking_fx',v.booking_fx,'payment_intent_id',pay.intent_id,'payment_state',pay.state,'payment_settle',pay.settle),v_result);
 insert into public.order_completion_proofs(order_id,proof_id) select v.id,x from pg_catalog.unnest(v_proofs) x;
 update public.order_assignments set ended_at=v_now,end_reason='completed' where id=p_assignment_id;
 update public.orders set status='completed',completed_at=v_now where id=v.id;
 return v_result;
end $function$;

commit;
