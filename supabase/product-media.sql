-- Run once in Supabase SQL Editor before deploying product galleries.
-- Existing cover images remain available in image_url.
alter table public.products
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists video_url text;
