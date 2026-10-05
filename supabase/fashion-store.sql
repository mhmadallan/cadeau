-- Run after all existing migrations, including customer-access.sql.
alter table public.products add column if not exists images jsonb not null default '[]';
alter table public.products add column if not exists variants jsonb not null default '[]';
alter table public.products add column if not exists collection text not null default '';
alter table public.products add column if not exists visible boolean not null default true;
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists new_arrival boolean not null default false;
alter table public.orders drop constraint if exists orders_quantity_check;
alter table public.orders add constraint orders_quantity_check check (quantity between 1 and 2970);
alter table public.orders add column if not exists items jsonb not null default '[]';
alter table public.orders add column if not exists status text not null default 'new' check (status in ('new','confirmed','dispatched','completed','cancelled'));

create or replace function public.place_cart_order(p_user_id uuid, p_customer_id uuid, p_request_id uuid, p_items jsonb, p_customer_name text, p_customer_phone text, p_delivery_address text, p_notes text)
returns jsonb language plpgsql set search_path = public as $$
declare saved public.orders%rowtype; product public.products%rowtype; line jsonb; variant jsonb; lines jsonb := '[]'; amount numeric := 0; qty integer; idx integer; count_items integer := 0;
begin
 if (p_user_id is null) = (p_customer_id is null) then raise exception 'INVALID_CUSTOMER'; end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(p_user_id,p_customer_id)::text,0));
 if p_customer_id is not null and not exists(select 1 from public.shop_customers where id=p_customer_id and status='approved') then raise exception 'ACCESS_NOT_APPROVED'; end if;
 select * into saved from public.orders where request_id=p_request_id and (user_id=p_user_id or customer_id=p_customer_id);
 if found then return jsonb_build_object('created',false,'order',to_jsonb(saved)); end if;
 if exists(select 1 from public.orders where (user_id=p_user_id or customer_id=p_customer_id) and created_at > now()-interval '1 minute') then raise exception 'ORDER_LIMIT'; end if;
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'INVALID_CART'; end if;
 -- Lock in stable product order to prevent deadlocks between customers.
 perform id from public.products where id in (select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x) order by id for update;
 for line in select * from jsonb_array_elements(p_items) loop
  qty := (line->>'quantity')::integer;
  if qty is null or qty not between 1 and 99 then raise exception 'INVALID_QUANTITY'; end if;
  select * into product from public.products where id=(line->>'product_id')::uuid and visible;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  variant := null;
  if jsonb_array_length(product.variants)>0 then
   select value, (ordinality-1)::integer into variant,idx from jsonb_array_elements(product.variants) with ordinality where value->>'id'=line->>'variant_id';
   if variant is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
   if (variant->>'stock')::integer < qty then raise exception 'OUT_OF_STOCK'; end if;
   update public.products set variants=jsonb_set(variants,array[idx::text,'stock'],to_jsonb((variant->>'stock')::integer-qty)), stock=greatest(0,stock-qty) where id=product.id;
  else
   if coalesce(line->>'variant_id','') <> '' then raise exception 'PRODUCT_NOT_FOUND'; end if;
   if product.stock<qty then raise exception 'OUT_OF_STOCK'; end if;
   update public.products set stock=stock-qty where id=product.id;
  end if;
  lines := lines || jsonb_build_array(jsonb_build_object('product_id',product.id,'product_name',product.name,'variant_id',line->>'variant_id','color',variant->>'color','size',variant->>'size','quantity',qty,'unit_price',product.price,'total',product.price*qty,'image_url',product.image_url));
  amount := amount + product.price*qty; count_items := count_items+qty;
 end loop;
 insert into public.orders(request_id,user_id,customer_id,product_id,product_name,quantity,unit_price,total,customer_name,customer_phone,delivery_address,notes,items)
 values(p_request_id,p_user_id,p_customer_id,(lines->0->>'product_id')::uuid,'Shopping bag',count_items,0,amount,p_customer_name,p_customer_phone,p_delivery_address,p_notes,lines) returning * into saved;
 return jsonb_build_object('created',true,'order',to_jsonb(saved));
end $$;
revoke all on function public.place_cart_order(uuid,uuid,uuid,jsonb,text,text,text,text) from public,anon,authenticated;
grant execute on function public.place_cart_order(uuid,uuid,uuid,jsonb,text,text,text,text) to service_role;
-- Close legacy stock reservation paths for products that now have variants.

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
  if not selected_product.visible or jsonb_array_length(selected_product.variants)>0 then raise exception 'PRODUCT_NOT_FOUND'; end if;
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
  if not selected_product.visible or jsonb_array_length(selected_product.variants)>0 then raise exception 'PRODUCT_NOT_FOUND'; end if;
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

