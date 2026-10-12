-- Run once in Supabase SQL Editor. Only the admin API can change these links.
create table if not exists public.social_links (
  id integer primary key check (id = 1),
  instagram text not null default '',
  facebook text not null default '',
  tiktok text not null default ''
);
alter table public.social_links enable row level security;
revoke all on public.social_links from anon, authenticated;
grant all on public.social_links to service_role;
insert into public.social_links (id) values (1) on conflict (id) do nothing;
