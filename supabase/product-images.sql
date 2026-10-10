-- Run in Supabase SQL Editor to enable admin device image uploads.
-- Public reads allow product images to load in WhatsApp messages.
-- Uploads go through the admin-only API using the server's service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
