-- Sparky (S2) reads a teammate's own presence to answer "why am I not getting orders".
-- The server's service role had no read grant on teammate_presence, so Sparky said it could not
-- see presence. Read only, and only the four columns lookup.ts selects (who set someone offline
-- stays private). Writes keep going through the presence functions.
begin;

grant select (user_id, online, last_seen_at, set_offline_reason) on table public.teammate_presence to service_role;

commit;
