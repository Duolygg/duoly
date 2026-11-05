-- Rocket League duos are sold per hour now (docs/product/pricing-review-2026-11.md): a match is only
-- about 7 minutes, so a per-game price never fit. Hourly orders don't get match reports, like the other
-- hourly games, so rl duo1/duo2/duo3 leave the win/loss list. The 3v3 fill (rl three) stays per game.
-- From 20261102160000_win_loss.sql; changed: without ('rl','duo1'),('rl','duo2'),('rl','duo3').
-- The list is the one in src/design-reference/lib/winloss.js (a unit test compares them).
begin;

create or replace function public.order_tracks_wl(p_order public.orders) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select not p_order.gg and (p_order.game, p_order.service) in (values ('lol','duo1'),('lol','duo2'),('lol','duo3'),('lol','ranked5'),('lol','flex'),('lol','clash'),('val','duo1'),('val','duo2'),('val','duo3'),('val','skirm'),('val','stack'),('val','premier'),('cs2','duo1'),('cs2','duo2'),('cs2','duo3'),('cs2','wing'),('cs2','five'),('cs2','faceit5'),('r6','duo1'),('r6','duo2'),('r6','duo3'),('r6','stack'),('mr','duo1'),('mr','duo2'),('mr','duo3'),('mr','teamup'),('mr','six'),('ow','duo1'),('ow','duo2'),('ow','duo3'),('ow','stadium'),('ow','five'),('rl','three'),('pu','duo1'),('pu','duo2'),('pu','duo3'),('pu','squad'));
$$;

commit;
