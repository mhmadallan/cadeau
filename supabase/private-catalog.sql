-- Run in the Supabase SQL Editor to prevent direct anonymous database access.
-- The app uses its authenticated Express API; that API uses service_role.
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant all on public.products to service_role;
