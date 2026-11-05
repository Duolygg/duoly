-- Durable per-account consent for delivery-time analytics identity decisions.
-- Apply before deploying consent sync; absent consent never grants identity.
create table public.analytics_consent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  analytics boolean not null,
  marketing boolean not null,
  updated_at timestamptz not null default now()
);

alter table public.analytics_consent enable row level security;
revoke all on table public.analytics_consent from public, anon, authenticated;
grant select, insert, update, delete on table public.analytics_consent to service_role;
