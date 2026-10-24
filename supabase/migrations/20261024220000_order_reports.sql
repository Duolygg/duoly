-- Customer reports with private screenshot evidence and manually paid €50 bounties.
-- Deploy code first with REPORTS_ENABLED=false, apply this migration, then enable the flag.
begin;

create table public.order_reports (
  id uuid primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  assignment_id uuid not null,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  teammate_id uuid not null references public.profiles(id) on delete restrict,
  type text not null check (type in ('off_platform','toxic')),
  description text not null check (pg_catalog.char_length(description) between 10 and 1000 and description = pg_catalog.btrim(description)),
  status text not null default 'open' check (status in ('open','approved','rejected')),
  bounty_eur_cents integer not null default 5000 check (bounty_eur_cents = 5000),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete restrict,
  decision_reason text check (decision_reason is null or pg_catalog.char_length(decision_reason) between 3 and 300),
  foreign key (assignment_id,order_id,teammate_id) references public.order_assignments(id,order_id,teammate_id) on delete restrict,
  check ((status='open' and decided_at is null and decided_by is null and decision_reason is null) or (status in ('approved','rejected') and decided_at is not null and decided_by is not null and decision_reason is not null))
);
create unique index order_reports_one_per_type on public.order_reports(order_id,customer_id,type);
create index order_reports_admin_queue on public.order_reports(status,created_at,id);
alter table public.order_reports enable row level security;
revoke all on public.order_reports from public,anon,authenticated,service_role;

create table public.order_report_evidence (
  id uuid primary key,
  report_id uuid not null references public.order_reports(id) on delete restrict,
  storage_key text not null unique,
  mime text not null check (mime in ('image/png','image/jpeg','image/webp')),
  byte_size integer not null check (byte_size between 1 and 1572864),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index order_report_evidence_report on public.order_report_evidence(report_id,created_at,id);
alter table public.order_report_evidence enable row level security;
revoke all on public.order_report_evidence from public,anon,authenticated,service_role;

create table public.order_report_bounties (
  report_id uuid primary key references public.order_reports(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  amount_eur_cents integer not null check (amount_eur_cents=5000),
  status text not null default 'owed' check (status in ('owed','paid')),
  recorded_at timestamptz not null default pg_catalog.clock_timestamp(),
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete restrict,
  payment_note text check (payment_note is null or pg_catalog.char_length(payment_note)<=300),
  check ((status='owed' and paid_at is null and paid_by is null) or (status='paid' and paid_at is not null and paid_by is not null))
);
alter table public.order_report_bounties enable row level security;
revoke all on public.order_report_bounties from public,anon,authenticated,service_role;
create trigger order_report_evidence_immutable before update or delete on public.order_report_evidence for each row execute function public.completion_immutable_guard();
create trigger order_report_bounties_immutable before update or delete on public.order_report_bounties for each row execute function public.completion_immutable_guard();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('report-evidence','report-evidence',false,1572864,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy report_evidence_no_raw_clients on storage.objects as restrictive for all to anon,authenticated
  using (bucket_id <> 'report-evidence') with check (bucket_id <> 'report-evidence');

create function public.order_report_customer_dto(p_report public.order_reports) returns jsonb
language sql stable security invoker set search_path='' as $$
 select pg_catalog.jsonb_build_object('id',p_report.id,'reference','R-'||pg_catalog.upper(pg_catalog.left(pg_catalog.replace(p_report.id::text,'-',''),8)),
  'type',p_report.type,'status',p_report.status,'bounty_eur_cents',p_report.bounty_eur_cents,'created_at',p_report.created_at,
  'decided_at',p_report.decided_at,'bounty_owed',exists(select 1 from public.order_report_bounties b where b.report_id=p_report.id));
$$;
revoke all on function public.order_report_customer_dto(public.order_reports) from public,anon,authenticated,service_role;

create function public.order_report_create(p_report_id uuid,p_order_id uuid,p_type text,p_description text,p_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_order public.orders; v_assignment public.order_assignments; v_report public.order_reports; v_item jsonb; v_count integer; v_key text; v_object storage.objects; v_description text;
begin
 if v_actor is null then return public.order_error(401,'Authentication required.'); end if;
 if not exists(select 1 from public.account_roles where user_id=v_actor and role='customer') then return public.order_error(403,'Customer role required.'); end if;
 if p_report_id is null or p_order_id is null or p_type not in ('off_platform','toxic') then return public.order_error(400,'Invalid report request.'); end if;
 v_description:=pg_catalog.btrim(coalesce(p_description,''));
 if pg_catalog.char_length(v_description) not between 10 and 1000 then return public.order_error(400,'Tell us what happened in a sentence or two.'); end if;
 if p_evidence is null or pg_catalog.jsonb_typeof(p_evidence)<>'array' then return public.order_error(400,'Add at least one screenshot as proof.'); end if;
 v_count:=pg_catalog.jsonb_array_length(p_evidence);
 if v_count not between 1 and 5 then return public.order_error(400,'Add 1 to 5 screenshots as proof.'); end if;
 select o.* into v_order from public.orders o where o.id=p_order_id and o.customer_id=v_actor for update;
 if v_order.id is null then return public.order_error(404,'Order not found.'); end if;
 if v_order.status not in ('in_progress','completed') then return public.order_error(409,'You can report a teammate while the order is in progress or after it is completed.'); end if;
 select a.* into v_assignment from public.order_assignments a where a.id=v_order.current_assignment_id and a.order_id=v_order.id and a.teammate_id=v_order.assigned_teammate_id for share;
 if v_assignment.id is null then return public.order_error(409,'This order has no teammate to report.'); end if;
 if exists(select 1 from public.order_reports r where r.order_id=v_order.id and r.customer_id=v_actor and r.type=p_type) then return public.order_error(409,'You already reported this. Our team is on it.'); end if;
 for v_item in select value from pg_catalog.jsonb_array_elements(p_evidence) loop
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_item))<>4 or not (v_item ?& array['id','mime','byte_size','sha256'])
   or coalesce(v_item->>'mime','') not in ('image/png','image/jpeg','image/webp')
   or coalesce(v_item->>'byte_size','')!~'^[0-9]+$' or (v_item->>'byte_size')::integer not between 1 and 1572864
   or coalesce(v_item->>'sha256','')!~'^[0-9a-f]{64}$' then return public.order_error(400,'Invalid report evidence.'); end if;
  begin perform (v_item->>'id')::uuid; exception when invalid_text_representation then return public.order_error(400,'Invalid report evidence.'); end;
  v_key:=v_order.id::text||'/'||p_report_id::text||'/'||(v_item->>'id');
  select o.* into v_object from storage.objects o where o.bucket_id='report-evidence' and o.name=v_key for share;
  if v_object.id is null or (v_object.metadata->>'size') is distinct from (v_item->>'byte_size')
   or (v_object.metadata->>'mimetype') is distinct from (v_item->>'mime') then return public.order_error(409,'Report evidence upload is incomplete.'); end if;
 end loop;
 insert into public.order_reports(id,order_id,assignment_id,customer_id,teammate_id,type,description)
 values(p_report_id,v_order.id,v_assignment.id,v_actor,v_assignment.teammate_id,p_type,v_description) returning * into v_report;
 for v_item in select value from pg_catalog.jsonb_array_elements(p_evidence) loop
  v_key:=v_order.id::text||'/'||p_report_id::text||'/'||(v_item->>'id');
  insert into public.order_report_evidence(id,report_id,storage_key,mime,byte_size,sha256)
  values((v_item->>'id')::uuid,v_report.id,v_key,v_item->>'mime',(v_item->>'byte_size')::integer,v_item->>'sha256');
 end loop;
 return pg_catalog.jsonb_build_object('report',public.order_report_customer_dto(v_report));
exception when unique_violation then return public.order_error(409,'You already reported this. Our team is on it.');
end $$;
revoke all on function public.order_report_create(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.order_report_create(uuid,uuid,text,text,jsonb) to authenticated;

create function public.admin_order_reports() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_caller()) then return public.order_error(403,'Admins only.'); end if;
 return pg_catalog.jsonb_build_object('bounty_eur_cents',5000,'reports',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',r.id,'reference','R-'||pg_catalog.upper(pg_catalog.left(pg_catalog.replace(r.id::text,'-',''),8)),'orderId',o.public_reference,'orderUuid',r.order_id,
  'type',r.type,'typeLabel',case r.type when 'off_platform' then 'Tried to move me off Duoly' else 'Toxic behaviour' end,
  'text',r.description,'status',r.status,'bounty',r.bounty_eur_cents/100.0,'currency','EUR','at',r.created_at,
  'byName',coalesce(nullif(cp.name,'Player'),cu.email,''),'against',pg_catalog.jsonb_build_object('name',coalesce(nullif(tp.name,'Player'),tu.email,'')),
  'decidedAt',r.decided_at,'decidedBy',coalesce(nullif(dp.name,'Player'),du.email),'decisionNote',r.decision_reason,
  'bountyOwed',b.report_id is not null,'evidence',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',e.id,'mime',e.mime,'byte_size',e.byte_size,'storage_key',e.storage_key) order by e.created_at,e.id) from public.order_report_evidence e where e.report_id=r.id),'[]'::jsonb)) order by r.created_at desc)
 from public.order_reports r join public.orders o on o.id=r.order_id join auth.users cu on cu.id=r.customer_id left join public.profiles cp on cp.id=r.customer_id
 join auth.users tu on tu.id=r.teammate_id left join public.profiles tp on tp.id=r.teammate_id left join auth.users du on du.id=r.decided_by left join public.profiles dp on dp.id=r.decided_by
 left join public.order_report_bounties b on b.report_id=r.id),'[]'::jsonb));
end $$;
revoke all on function public.admin_order_reports() from public,anon,authenticated,service_role;
grant execute on function public.admin_order_reports() to authenticated;

create function public.admin_order_report_decide(p_report_id uuid,p_decision text,p_reason text) returns jsonb
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
 if p_decision='approved' then insert into public.order_report_bounties(report_id,customer_id,amount_eur_cents) values(v_report.id,v_report.customer_id,5000); end if;
 perform public.admin_log(v_actor,v_name,case when p_decision='approved' then 'Approved report' else 'Rejected report' end,
  'R-'||pg_catalog.upper(pg_catalog.left(pg_catalog.replace(v_report.id::text,'-',''),8)),v_reason||case when p_decision='approved' then ' · €50 bounty owed' else '' end);
 return pg_catalog.jsonb_build_object('report',public.order_report_customer_dto(v_report));
end $$;
revoke all on function public.admin_order_report_decide(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_order_report_decide(uuid,text,text) to authenticated;

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
        'bio', p.bio, 'languages', pg_catalog.to_jsonb(p.languages)) from public.profiles as p where p.id = p_order.assigned_teammate_id),
    'review', (select public.order_review_dto(r) from public.order_reviews as r where r.order_id=p_order.id),
    'reports', coalesce((select pg_catalog.jsonb_agg(public.order_report_customer_dto(r) order by r.created_at) from public.order_reports r where r.order_id=p_order.id and r.customer_id=p_order.customer_id),'[]'::jsonb));
$$;

commit;
