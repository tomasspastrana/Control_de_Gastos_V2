-- ============================================================
-- Tarjetero — RLS, foreign keys to auth.users, and profile trigger
-- Run this in the Supabase SQL editor AFTER `npm run db:push`
-- (which creates the tables/enums). Safe to re-run (idempotent-ish).
-- ============================================================

-- 1) Foreign keys to Supabase's managed auth.users -------------
alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  add constraint profiles_id_fkey foreign key (id)
    references auth.users (id) on delete cascade;

alter table public.cards
  drop constraint if exists cards_user_id_fkey,
  add constraint cards_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade;

alter table public.purchases
  drop constraint if exists purchases_user_id_fkey,
  add constraint purchases_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade;

alter table public.debts
  drop constraint if exists debts_user_id_fkey,
  add constraint debts_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade;

-- 2) Enable Row Level Security --------------------------------
alter table public.profiles  enable row level security;
alter table public.cards     enable row level security;
alter table public.purchases enable row level security;
alter table public.debts     enable row level security;

-- 3) Policies: each user can only touch their own rows --------
-- profiles: keyed by id (= auth.uid())
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- helper: apply the same 4 policies to a user_id-owned table
do $$
declare t text;
begin
  foreach t in array array['cards','purchases','debts'] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s', t);
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$s', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- 4) Auto-create a profile row when a user signs up ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
