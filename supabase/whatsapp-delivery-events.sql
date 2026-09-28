-- Delivery history is independent of the selected order notification channel.
-- Retaining events also handles events arriving before a send response is saved.
create table if not exists public.whatsapp_delivery_events (
  event_key text primary key,
  message_id text not null,
  status text not null check (status in ('sent', 'delivered', 'read', 'failed')),
  event_timestamp bigint not null,
  error_codes integer[] not null default '{}',
  received_at timestamptz not null default now()
);
create index if not exists whatsapp_delivery_message_time
  on public.whatsapp_delivery_events(message_id, event_timestamp desc);
alter table public.whatsapp_delivery_events enable row level security;
revoke all on public.whatsapp_delivery_events from anon, authenticated;
grant all on public.whatsapp_delivery_events to service_role;
