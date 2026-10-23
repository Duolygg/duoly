-- Test metadata only; caller MUST wrap in rollback (or use a disposable local DB).
create function pg_temp.completion_fixture(p_teammate uuid default null) returns jsonb language plpgsql as $$
declare c uuid := gen_random_uuid(); t uuid := coalesce(p_teammate,gen_random_uuid()); o uuid := gen_random_uuid();
 a uuid := gen_random_uuid(); p uuid := gen_random_uuid(); i uuid := gen_random_uuid();
 n timestamptz := clock_timestamp();
begin
 insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values(c,'{}','{}');
 if p_teammate is null then
  insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values(t,'{}','{}');
  update public.account_roles set role='teammate' where user_id=t;
  insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at,priority_base)
  values(t,array['lol'],'9' || lpad((abs(hashtext(t::text)::bigint))::text,17,'0'),n,0);
 end if;
 insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,region,ign,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
 values(o,'DL-' || ('x' || substr(replace(o::text,'-',''),1,15))::bit(60)::bigint,c,'lol','duo','Completion fixture',1,'game','EUW','Fixture','Fixture',999,1.08,105,n,n);
 insert into public.order_assignments(id,order_id,teammate_id,accepted_at) values(a,o,t,n);
 update public.orders set status='in_progress',assigned_teammate_id=t,current_assignment_id=a,accepted_at=n where id=o;
 insert into public.order_proof_uploads(id,order_id,assignment_id,uploader_id,request_id,state,mime,byte_size,sha256,created_at,ready_at)
 values(p,o,a,t,gen_random_uuid(),'ready','image/png',12,repeat('a',64),n,n);
 insert into public.checkout_intents(id,customer_id,game,service,title,units,unit,region,ign,amount_eur_cents,payout_usd_cents,booking_fx,expires_at)
 values(i,c,'lol','duo','Completion fixture',1,'game','EUW','Fixture',999,105,1.08,n+interval '1 hour');
 insert into public.order_payments(order_id,intent_id,stripe_payment_intent_id,amount_minor,currency,amount_eur_cents,payment_method_type,state,settle)
 values(o,i,'pi_completion' || replace(i::text,'-',''),999,'eur',999,'card','captured','none');
 return jsonb_build_object('customer',c,'teammate',t,'order',o,'assignment',a,'proof',p,'request',gen_random_uuid());
end $$;
create function pg_temp.completion_login(actor text) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claim.sub',coalesce(actor,''),true);
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
end $$;
create function pg_temp.completion_assert(ok boolean, label text) returns void language plpgsql as $$
begin
 if ok is distinct from true then raise exception 'completion assertion: %',label; end if;
end $$;
select set_config('completion.fixture',pg_temp.completion_fixture()::text,true);
