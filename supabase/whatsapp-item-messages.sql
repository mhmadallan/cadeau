-- Run before enabling WHATSAPP_ORDER_PER_ITEM. Existing order access controls apply.
alter table public.orders add column if not exists whatsapp_item_messages jsonb not null default '[]'::jsonb;
