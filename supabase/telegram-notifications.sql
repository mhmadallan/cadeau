-- Run once after orders.sql. Keeps all existing WhatsApp order records intact.
alter table public.orders
  add column if not exists notification_provider text not null default 'whatsapp'
    check (notification_provider in ('whatsapp', 'telegram')),
  add column if not exists notification_message_id text;

-- Preserve historical WhatsApp message IDs in the provider-neutral field as well.
update public.orders
set notification_message_id = whatsapp_message_id
where notification_provider = 'whatsapp'
  and notification_message_id is null
  and whatsapp_message_id is not null;
