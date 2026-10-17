create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  description text not null,
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  transaction_type text not null default 'expense'
    check (transaction_type in ('income', 'expense')),
  source text not null check (source in ('Telegram', 'Web Dashboard')),
  telegram_update_id bigint unique,
  created_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists telegram_update_id bigint unique;

alter table public.transactions
  add column if not exists transaction_type text not null default 'expense'
    check (transaction_type in ('income', 'expense'));

alter table public.transactions enable row level security;

create index if not exists transactions_date_idx
  on public.transactions (date desc);

create index if not exists transactions_category_idx
  on public.transactions (category);

-- User profiles map a username to the corresponding Supabase Auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  telegram_chat_id bigint unique,
  telegram_link_code text,
  telegram_link_expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists telegram_chat_id bigint unique,
  add column if not exists telegram_link_code text,
  add column if not exists telegram_link_expires_at timestamptz;

create unique index if not exists profiles_username_ci_idx
  on public.profiles (lower(username));

create unique index if not exists profiles_telegram_link_code_idx
  on public.profiles (telegram_link_code)
  where telegram_link_code is not null;

alter table public.transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "users can read own transactions" on public.transactions;
create policy "users can read own transactions"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users can insert own transactions" on public.transactions;
create policy "users can insert own transactions"
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users can update own transactions" on public.transactions;
create policy "users can update own transactions"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users can delete own transactions" on public.transactions;
create policy "users can delete own transactions"
  on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_username text;
begin
  new_username := lower(trim(new.raw_user_meta_data ->> 'username'));
  if new_username is null or new_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'A valid username is required';
  end if;

  insert into public.profiles (id, username)
  values (new.id, new_username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();
