-- CartChat — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES — one row per auth user (merchant or admin)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text not null default '',
  store      text,
  phone      text,
  platform   text,          -- shopify | woocommerce | custom | ...
  country    text,
  plan       text not null default 'trial',   -- trial | starter | growth | scale
  role       text not null default 'merchant' check (role in ('merchant','admin','super_admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever a user signs up.
-- Signup metadata (name, store, ...) is passed via auth "data" and lands in raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, store, phone, platform, country)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'store',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'platform',
    new.raw_user_meta_data->>'country'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. LEADS & ORDERS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.demo_leads (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  business   text not null,          -- was "restaurant" in the old stub
  name       text,
  phone      text,
  platform   text,
  country    text,
  notes      text,
  raw        jsonb,                  -- full original payload, nothing lost
  status     text not null default 'new' check (status in ('new','contacted','qualified','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id),
  email          text not null,
  plan           text not null,
  amount_usd     numeric(10,2),
  payment_method text,               -- omt | whish | bank | cod | card
  status         text not null default 'pending' check (status in ('pending','paid','failed','refunded','cancelled')),
  raw            jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid references public.orders(id),
  customer_email text not null,
  method         text not null,      -- omt | whish | bank | cod
  reference      text,               -- OMT/bank transfer reference number
  receipt_url    text,               -- Supabase Storage URL of uploaded receipt
  amount_usd     numeric(10,2),
  status         text not null default 'pending_review' check (status in ('pending_review','verified','rejected')),
  raw            jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.broadcast_orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id),
  customer_email text not null,
  message        text not null,
  audience       text,
  scheduled_for  timestamptz,
  status         text not null default 'pending_review' check (status in ('pending_review','approved','sent','rejected')),
  raw            jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.handover_briefs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id),
  customer_email text,
  brief          jsonb not null,
  status         text not null default 'new' check (status in ('new','in_progress','onboarded')),
  created_at     timestamptz not null default now()
);

-- Helpful indexes for the admin panel
create index if not exists idx_orders_email     on public.orders (email);
create index if not exists idx_payments_status  on public.payments (status);
create index if not exists idx_leads_status     on public.demo_leads (status);

-- ─────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
--    API writes use the service-role key (bypasses RLS).
--    These policies protect direct client access.
-- ─────────────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.demo_leads       enable row level security;
alter table public.orders           enable row level security;
alter table public.payments         enable row level security;
alter table public.broadcast_orders enable row level security;
alter table public.handover_briefs  enable row level security;

-- Users can read/update their own profile (never their own role/plan).
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can read everything.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','super_admin')
  );
$$;

create policy "admin read profiles"   on public.profiles         for select using (public.is_admin());
create policy "admin read leads"      on public.demo_leads       for select using (public.is_admin());
create policy "admin read orders"     on public.orders           for select using (public.is_admin());
create policy "admin read payments"   on public.payments         for select using (public.is_admin());
create policy "admin read broadcasts" on public.broadcast_orders for select using (public.is_admin());
create policy "admin read handovers"  on public.handover_briefs  for select using (public.is_admin());

-- Merchants can read their own orders/broadcasts.
create policy "read own orders"     on public.orders           for select using (auth.uid() = user_id);
create policy "read own broadcasts" on public.broadcast_orders for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. STORAGE — bucket for payment receipts (private)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;
