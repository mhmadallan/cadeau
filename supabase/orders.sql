-- Run once in the Supabase SQL Editor after schema.sql.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null references auth.users(id),
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total numeric(12,2) not null check (total >= 0),
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  notes text not null default '',
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'accepted', 'unknown')),
  whatsapp_message_id text,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant all on public.orders to service_role;
create index if not exists orders_user_created on public.orders(user_id, created_at desc);

create or replace function public.place_order(
  p_user_id uuid, p_request_id uuid, p_product_id uuid, p_quantity integer,
  p_customer_name text, p_customer_phone text, p_delivery_address text, p_notes text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  selected_product public.products%rowtype;
  saved_order public.orders%rowtype;
begin
  -- Serialize requests for a user, including retries across multiple server instances.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into saved_order from public.orders
    where user_id = p_user_id and request_id = p_request_id;
  if found then
    return jsonb_build_object('created', false, 'order', to_jsonb(saved_order));
  end if;
  if exists (select 1 from public.orders where user_id = p_user_id and created_at > now() - interval '1 minute') then
    raise exception 'ORDER_LIMIT';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    raise exception 'INVALID_QUANTITY';
  end if;
  select * into selected_product from public.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if selected_product.stock < p_quantity then raise exception 'OUT_OF_STOCK'; end if;
  insert into public.orders (
    request_id, user_id, product_id, product_name, quantity, unit_price, total,
    customer_name, customer_phone, delivery_address, notes
  ) values (
    p_request_id, p_user_id, p_product_id, selected_product.name, p_quantity,
    selected_product.price, selected_product.price * p_quantity,
    p_customer_name, p_customer_phone, p_delivery_address, p_notes
  ) returning * into saved_order;
  update public.products set stock = stock - p_quantity where id = p_product_id;
  return jsonb_build_object('created', true, 'order', to_jsonb(saved_order));
end;
$$;

revoke all on function public.place_order(uuid, uuid, uuid, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, uuid, integer, text, text, text, text) to service_role;
