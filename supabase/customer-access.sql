-- Run after orders.sql. Phone access is an approval gate, not proof of identity.
create table if not exists public.shop_customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  name text not null check (length(name) between 1 and 100),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  request_notification text,
  approval_notification text
);
create table if not exists public.customer_sessions (
  token_hash text primary key,
  customer_id uuid not null references public.shop_customers(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.shop_customers enable row level security;
alter table public.customer_sessions enable row level security;
revoke all on public.shop_customers, public.customer_sessions from anon, authenticated;
grant all on public.shop_customers, public.customer_sessions to service_role;
create index if not exists customer_sessions_customer on public.customer_sessions(customer_id);
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists customer_id uuid references public.shop_customers(id);
create unique index if not exists orders_customer_request on public.orders(customer_id,request_id);
create index if not exists orders_customer_created on public.orders(customer_id,created_at desc);

create or replace function public.place_customer_order(
  p_customer_id uuid, p_request_id uuid, p_product_id uuid, p_quantity integer,
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
  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));
  if not exists (select 1 from public.shop_customers where id = p_customer_id and status = 'approved') then
    raise exception 'ACCESS_NOT_APPROVED';
  end if;
  select * into saved_order from public.orders
    where customer_id = p_customer_id and request_id = p_request_id;
  if found then
    return jsonb_build_object('created', false, 'order', to_jsonb(saved_order));
  end if;
  if exists (select 1 from public.orders where customer_id = p_customer_id and created_at > now() - interval '1 minute') then
    raise exception 'ORDER_LIMIT';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    raise exception 'INVALID_QUANTITY';
  end if;
  select * into selected_product from public.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if selected_product.stock < p_quantity then raise exception 'OUT_OF_STOCK'; end if;
  insert into public.orders (
    request_id, customer_id, product_id, product_name, quantity, unit_price, total,
    customer_name, customer_phone, delivery_address, notes
  ) values (
    p_request_id, p_customer_id, p_product_id, selected_product.name, p_quantity,
    selected_product.price, selected_product.price * p_quantity,
    p_customer_name, p_customer_phone, p_delivery_address, p_notes
  ) returning * into saved_order;
  update public.products set stock = stock - p_quantity where id = p_product_id;
  return jsonb_build_object('created', true, 'order', to_jsonb(saved_order));
end;
$$;

revoke all on function public.place_customer_order(uuid, uuid, uuid, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.place_customer_order(uuid, uuid, uuid, integer, text, text, text, text) to service_role;
