-- Customer wallet ledger, audited admin adjustments and report bounty wallet credits.
-- Apply this migration before deploying code that reads wallet balances or calls admin_wallet_adjust.
begin;

create table public.wallet_entries (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  amount_eur_cents integer not null check (amount_eur_cents <> 0),
  kind text not null check (kind in ('refund','cashback','cashback_reversal','level_gift','bounty','admin_credit','admin_debit','checkout_hold','checkout_spend','checkout_release')),
  cashable boolean not null,
  order_id uuid references public.orders(id) on delete restrict,
  report_id uuid references public.order_reports(id) on delete restrict,
  refund_credit_id uuid references public.refund_credits(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict,
  reason text check (reason is null or (reason=pg_catalog.btrim(reason) and pg_catalog.char_length(reason) between 1 and 200)),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((kind in ('refund','cashback','level_gift','bounty','admin_credit','checkout_release') and amount_eur_cents > 0)
    or (kind in ('cashback_reversal','admin_debit','checkout_hold','checkout_spend') and amount_eur_cents < 0)),
  check ((kind='refund' and cashable) or kind<>'refund'),
  check ((kind in ('cashback','cashback_reversal','level_gift','bounty','admin_credit') and not cashable) or kind not in ('cashback','cashback_reversal','level_gift','bounty','admin_credit')),
  check ((kind='refund')=(refund_credit_id is not null)),
  check ((kind='bounty')=(report_id is not null)),
  check (kind not in ('admin_credit','admin_debit') or (created_by is not null and reason is not null))
);
create index wallet_entries_customer_created on public.wallet_entries(customer_id,created_at desc,id);
create unique index wallet_entries_refund_once on public.wallet_entries(refund_credit_id) where refund_credit_id is not null;
create unique index wallet_entries_bounty_once on public.wallet_entries(report_id) where report_id is not null;
alter table public.wallet_entries enable row level security;
revoke all on table public.wallet_entries from public,anon,authenticated,service_role;
grant select on table public.wallet_entries to service_role;

create function public.wallet_entry_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_balance bigint;
begin
  if tg_op <> 'INSERT' then raise sqlstate 'PT409' using message='Wallet entries are immutable.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.customer_id::text,713));
  select coalesce(pg_catalog.sum(e.amount_eur_cents),0) into v_balance
    from public.wallet_entries e where e.customer_id=new.customer_id and e.cashable=new.cashable;
  if v_balance + new.amount_eur_cents < 0 then raise sqlstate 'PT409' using message='Wallet balance cannot go below zero.'; end if;
  return new;
end $$;
create trigger wallet_entries_guard before insert or update or delete on public.wallet_entries
  for each row execute function public.wallet_entry_guard();

create view public.wallet_balances as
select p.id as customer_id,
  coalesce(pg_catalog.sum(e.amount_eur_cents),0)::bigint as total_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.cashable),0)::bigint as cashable_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where not e.cashable),0)::bigint as promo_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='refund'),0)::bigint as refunds_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind in ('cashback','cashback_reversal')),0)::bigint as cashback_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='level_gift'),0)::bigint as level_gifts_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='bounty'),0)::bigint as bounty_eur_cents,
  coalesce(pg_catalog.sum(e.amount_eur_cents) filter(where e.kind in ('admin_credit','admin_debit')),0)::bigint as admin_eur_cents,
  coalesce(-pg_catalog.sum(e.amount_eur_cents) filter(where e.kind='checkout_spend'),0)::bigint as spent_eur_cents
from public.profiles p left join public.wallet_entries e on e.customer_id=p.id
group by p.id;
revoke all on public.wallet_balances from public,anon,authenticated,service_role;
grant select on public.wallet_balances to service_role;

create function public.refund_credit_post_wallet() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,order_id,refund_credit_id,reason,created_at)
 values(new.customer_id,new.amount_eur_cents,'refund',true,new.order_id,new.id,'Refund credit',new.created_at)
 on conflict do nothing;
 return new;
end $$;
create trigger refund_credits_post_wallet after insert on public.refund_credits
 for each row execute function public.refund_credit_post_wallet();

insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,order_id,refund_credit_id,reason,created_at)
select c.customer_id,c.amount_eur_cents,'refund',true,c.order_id,c.id,'Migrated refund credit',c.created_at
from public.refund_credits c on conflict do nothing;

create or replace function public.customer_refund_credits(p_limit integer default 50,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_entries jsonb; v_balance jsonb; v_id uuid;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 if not exists(select 1 from public.account_roles r where r.user_id=v_actor and r.role='customer') then return public.order_error(403,'Customer role required.'); end if;
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then return public.order_error(400,'Invalid pagination.'); end if;
 for v_id in select o.id from public.orders o where o.customer_id=v_actor and o.status='queued' loop perform public.order_expire_locked(v_id); end loop;
 perform public.order_sweep(100);
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',q.id,'order_id',q.order_id,'kind',q.kind,
  'amount_eur_cents',q.amount_eur_cents,'cashable',q.cashable,'created_at',q.created_at) order by q.created_at desc,q.id),'[]'::jsonb)
 into v_entries from (select e.* from public.wallet_entries e where e.customer_id=v_actor order by e.created_at desc,e.id limit p_limit offset p_offset) q;
 select pg_catalog.to_jsonb(b)-'customer_id' into v_balance from public.wallet_balances b where b.customer_id=v_actor;
 return pg_catalog.jsonb_build_object('credits',v_entries,'balance',coalesce(v_balance,'{}'::jsonb));
end $$;

create or replace function public.admin_customers() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
 return pg_catalog.jsonb_build_object('customers',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',r.user_id,'name',coalesce(nullif(p.name,'Player'),u.email,''),'email',coalesce(u.email,''),
  'provider',coalesce(u.raw_app_meta_data->>'provider','email'),'image',coalesce(p.image,''),'country',coalesce(p.country,''),'joined',u.created_at,
  'placed',(select pg_catalog.count(*) from public.orders o where o.customer_id=r.user_id),
  'completed',(select pg_catalog.count(*) from public.orders o where o.customer_id=r.user_id and o.status='completed'),
  'spentCents',coalesce((select pg_catalog.sum(o.amount_eur_cents) from public.orders o where o.customer_id=r.user_id and o.status<>'cancelled'),0),
  'walletCents',coalesce(w.total_eur_cents,0),'walletCashableCents',coalesce(w.cashable_eur_cents,0),'walletPromoCents',coalesce(w.promo_eur_cents,0),
  'giftedCents',coalesce(w.admin_eur_cents,0),'adjustments',(select pg_catalog.count(*) from public.wallet_entries e where e.customer_id=r.user_id and e.kind in ('admin_credit','admin_debit')),
  'lastOrderAt',(select pg_catalog.max(o.created_at) from public.orders o where o.customer_id=r.user_id),
  'warnings',(select pg_catalog.count(*) from public.order_chat_flags f where f.actor_id=r.user_id and f.status='warned'),
  'blocked',case when b.user_id is null then null else pg_catalog.jsonb_build_object('reason',b.reason,'at',b.blocked_at,'by',coalesce((select coalesce(nullif(bp.name,'Player'),bu.email) from auth.users bu left join public.profiles bp on bp.id=bu.id where bu.id=b.blocked_by),'')) end)
  order by u.created_at desc) from public.account_roles r join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
  left join public.customer_blocks b on b.user_id=r.user_id left join public.wallet_balances w on w.customer_id=r.user_id where r.role='customer'),'[]'::jsonb));
end $$;

create function public.admin_wallet_adjust(p_user_id uuid,p_amount_eur_cents integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_name text; v_label text; v_reason text:=pg_catalog.btrim(coalesce(p_reason,'')); v_cashable bigint; v_promo bigint; v_take bigint; v_left bigint;
begin
 select id,name into v_actor,v_name from public.admin_caller();
 if v_actor is null then return public.order_error(403,'Admins only.'); end if;
 if p_amount_eur_cents is null or p_amount_eur_cents=0 or pg_catalog.abs(p_amount_eur_cents)>100000 then return public.order_error(400,'Amount must be between -1000 and 1000 EUR and cannot be zero.'); end if;
 if pg_catalog.char_length(v_reason) not between 1 and 200 then return public.order_error(400,'Add a reason up to 200 characters.'); end if;
 if not exists(select 1 from public.account_roles where user_id=p_user_id and role='customer') then return public.order_error(404,'Customer not found.'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,713));
 select coalesce(b.cashable_eur_cents,0),coalesce(b.promo_eur_cents,0) into v_cashable,v_promo from public.wallet_balances b where b.customer_id=p_user_id;
 if p_amount_eur_cents<0 and v_cashable+v_promo < -p_amount_eur_cents then return public.order_error(409,'The wallet cannot go below zero.'); end if;
 if p_amount_eur_cents>0 then
  insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason) values(p_user_id,p_amount_eur_cents,'admin_credit',false,v_actor,v_reason);
 else
  v_left:=-p_amount_eur_cents; v_take:=least(v_left,v_promo);
  if v_take>0 then insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason) values(p_user_id,-v_take,'admin_debit',false,v_actor,v_reason); v_left:=v_left-v_take; end if;
  if v_left>0 then insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,created_by,reason) values(p_user_id,-v_left,'admin_debit',true,v_actor,v_reason); end if;
 end if;
 select coalesce(nullif(p.name,'Player'),u.email,'') into v_label from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user_id;
 perform public.admin_log(v_actor,v_name,case when p_amount_eur_cents>0 then 'Credited customer wallet' else 'Debited customer wallet' end,v_label,v_reason||' · '||p_amount_eur_cents||' cents');
 return pg_catalog.jsonb_build_object('ok',true,'balance',(select pg_catalog.to_jsonb(b)-'customer_id' from public.wallet_balances b where b.customer_id=p_user_id));
end $$;

-- Existing approved bounties move to the wallet once and are marked paid by wallet.
insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,report_id,created_by,reason,created_at)
select b.customer_id,b.amount_eur_cents,'bounty',false,b.report_id,r.decided_by,'Approved report bounty',coalesce(r.decided_at,b.recorded_at)
from public.order_report_bounties b join public.order_reports r on r.id=b.report_id where b.status='owed' on conflict do nothing;
alter table public.order_report_bounties disable trigger order_report_bounties_immutable;
update public.order_report_bounties set status='paid',paid_at=coalesce(paid_at,pg_catalog.clock_timestamp()),paid_by=coalesce(paid_by,(select r.decided_by from public.order_reports r where r.id=report_id)),payment_note='Wallet credit' where status='owed';
alter table public.order_report_bounties enable trigger order_report_bounties_immutable;

create or replace function public.admin_order_report_decide(p_report_id uuid,p_decision text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_name text; v_report public.order_reports; v_reason text;
begin
 select id,name into v_actor,v_name from public.admin_caller();
 if v_actor is null then return public.order_error(403,'Admins only.'); end if;
 v_reason:=pg_catalog.btrim(coalesce(p_reason,''));
 if p_decision not in ('approved','rejected') or pg_catalog.char_length(v_reason) not between 3 and 300 then return public.order_error(400,'Add a reason between 3 and 300 characters.'); end if;
 select r.* into v_report from public.order_reports r where r.id=p_report_id for update;
 if v_report.id is null then return public.order_error(404,'Report not found.'); end if;
 if v_report.status<>'open' then return public.order_error(409,'This report was already decided.'); end if;
 update public.order_reports set status=p_decision,decided_at=pg_catalog.clock_timestamp(),decided_by=v_actor,decision_reason=v_reason where id=v_report.id returning * into v_report;
 if p_decision='approved' then
  insert into public.order_report_bounties(report_id,customer_id,amount_eur_cents,status,paid_at,paid_by,payment_note)
   values(v_report.id,v_report.customer_id,5000,'paid',pg_catalog.clock_timestamp(),v_actor,'Wallet credit');
  insert into public.wallet_entries(customer_id,amount_eur_cents,kind,cashable,report_id,created_by,reason)
   values(v_report.customer_id,5000,'bounty',false,v_report.id,v_actor,'Approved report bounty');
 end if;
 perform public.admin_log(v_actor,v_name,case when p_decision='approved' then 'Approved report' else 'Rejected report' end,
  'R-'||pg_catalog.upper(pg_catalog.left(pg_catalog.replace(v_report.id::text,'-',''),8)),v_reason||case when p_decision='approved' then ' · €50 wallet bounty paid' else '' end);
 return pg_catalog.jsonb_build_object('report',public.order_report_customer_dto(v_report));
end $$;

revoke all on function public.admin_wallet_adjust(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_wallet_adjust(uuid,integer,text) to authenticated;
-- Preserve existing callers and grants after CREATE OR REPLACE.
revoke all on function public.customer_refund_credits(integer,integer),public.admin_customers(),public.admin_order_report_decide(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.customer_refund_credits(integer,integer),public.admin_customers(),public.admin_order_report_decide(uuid,text,text) to authenticated;

commit;
