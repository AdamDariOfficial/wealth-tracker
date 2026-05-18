
-- =========================================================
-- PHASE 3: LEDGER ARCHITECTURE
-- =========================================================

-- ENUMS
do $$ begin
  create type public.account_type as enum ('bank','exchange','broker','crypto_wallet','cold_wallet','cash','savings','investment','external');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_class as enum ('fiat','crypto','etf','stock','commodity','forex','cash','stablecoin','custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum (
    'deposit','withdrawal','transfer','buy','sell','convert',
    'fee','dividend','interest','staking_reward','profit_realization','manual_adjustment'
  );
exception when duplicate_object then null; end $$;

-- =========================================================
-- ACCOUNTS
-- =========================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  type public.account_type not null default 'bank',
  provider text,
  currency text not null default 'USD',
  current_balance numeric not null default 0,
  icon text,
  color text default '#22d3ee',
  description text,
  visible boolean not null default true,
  include_in_net_worth boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.accounts enable row level security;
drop policy if exists "own accounts" on public.accounts;
create policy "own accounts" on public.accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_accounts_user on public.accounts(user_id);

drop trigger if exists touch_accounts on public.accounts;
create trigger touch_accounts before update on public.accounts
  for each row execute function public.touch_updated_at();

-- =========================================================
-- ASSETS
-- =========================================================
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  symbol text not null,
  name text not null,
  asset_class public.asset_class not null default 'crypto',
  color text default '#22d3ee',
  icon text,
  current_price numeric not null default 0,
  custom_asset boolean not null default false,
  tracking_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol)
);
alter table public.assets enable row level security;
drop policy if exists "own assets" on public.assets;
create policy "own assets" on public.assets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_assets_user on public.assets(user_id);

drop trigger if exists touch_assets on public.assets;
create trigger touch_assets before update on public.assets
  for each row execute function public.touch_updated_at();

-- =========================================================
-- TRANSACTIONS
-- =========================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  transaction_type public.transaction_type not null,
  source_account_id uuid references public.accounts(id) on delete set null,
  destination_account_id uuid references public.accounts(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  quantity numeric not null default 0,
  fiat_value numeric not null default 0,
  fee_amount numeric not null default 0,
  fee_asset_id uuid references public.assets(id) on delete set null,
  exchange_rate numeric,
  note text,
  tags text[] not null default '{}',
  execution_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_tx_user_time on public.transactions(user_id, execution_timestamp desc);
create index if not exists idx_tx_source on public.transactions(source_account_id);
create index if not exists idx_tx_dest on public.transactions(destination_account_id);
create index if not exists idx_tx_asset on public.transactions(asset_id);

drop trigger if exists touch_transactions on public.transactions;
create trigger touch_transactions before update on public.transactions
  for each row execute function public.touch_updated_at();

-- =========================================================
-- SNAPSHOTS V2 (finer granularity)
-- =========================================================
create table if not exists public.portfolio_snapshots_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  granularity text not null default 'daily', -- hourly|daily|weekly|monthly
  taken_at timestamptz not null default now(),
  net_worth numeric not null default 0,
  liquid_value numeric not null default 0,
  invested_value numeric not null default 0,
  realized_pnl numeric not null default 0,
  unrealized_pnl numeric not null default 0,
  breakdown jsonb not null default '{}'::jsonb
);
alter table public.portfolio_snapshots_v2 enable row level security;
drop policy if exists "own snapshots v2" on public.portfolio_snapshots_v2;
create policy "own snapshots v2" on public.portfolio_snapshots_v2 for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_snap2_user_time on public.portfolio_snapshots_v2(user_id, taken_at desc);

-- =========================================================
-- BACKFILL: seed default assets + migrate existing balances
-- =========================================================
do $$
declare u record;
  a_usd uuid; a_eur uuid; a_btc uuid; a_eth uuid; a_sol uuid;
  acc_id uuid; asset_id uuid;
  r record;
begin
  for u in select distinct id as uid from auth.users loop
    -- seed core assets
    insert into public.assets (user_id, symbol, name, asset_class, color, current_price)
    values
      (u.uid,'USD','US Dollar','fiat','#10b981',1),
      (u.uid,'EUR','Euro','fiat','#3b82f6',1.08),
      (u.uid,'BTC','Bitcoin','crypto','#f7931a',0),
      (u.uid,'ETH','Ethereum','crypto','#627eea',0),
      (u.uid,'SOL','Solana','crypto','#9945ff',0)
    on conflict (user_id, symbol) do nothing;

    select id into a_usd from public.assets where user_id=u.uid and symbol='USD';

    -- migrate cash_reserves -> accounts (bank) + deposit tx
    for r in select * from public.cash_reserves where user_id=u.uid loop
      insert into public.accounts (user_id, name, type, currency, current_balance, description)
      values (u.uid, r.label, 'bank', 'USD', r.balance, r.purpose)
      returning id into acc_id;
      if r.balance > 0 then
        insert into public.transactions (user_id, transaction_type, destination_account_id, asset_id, quantity, fiat_value, execution_timestamp, note)
        values (u.uid, 'deposit', acc_id, a_usd, r.balance, r.balance, r.created_at, 'Initial balance import');
      end if;
    end loop;

    -- migrate trading_account -> broker account
    for r in select * from public.trading_account where user_id=u.uid loop
      insert into public.accounts (user_id, name, type, currency, current_balance, description)
      values (u.uid, coalesce(r.primary_asset,'Trading Account')||' (Broker)', 'broker', 'USD', r.balance, 'Imported trading account')
      returning id into acc_id;
      if r.balance > 0 then
        insert into public.transactions (user_id, transaction_type, destination_account_id, asset_id, quantity, fiat_value, execution_timestamp, note)
        values (u.uid, 'deposit', acc_id, a_usd, r.balance, r.balance, now(), 'Trading capital import');
      end if;
    end loop;

    -- migrate investments -> investment account + buy tx
    for r in select * from public.investments where user_id=u.uid loop
      insert into public.assets (user_id, symbol, name, asset_class, current_price, custom_asset)
      values (u.uid, coalesce(r.ticker, upper(left(r.name,6))), r.name,
        case r.asset_class when 'etf' then 'etf'::asset_class when 'stock' then 'stock'::asset_class else 'custom'::asset_class end,
        r.current_price, true)
      on conflict (user_id, symbol) do update set current_price=excluded.current_price
      returning id into asset_id;

      insert into public.accounts (user_id, name, type, currency, current_balance, include_in_net_worth)
      values (u.uid, r.name||' Position', 'investment', 'USD', r.quantity*r.current_price, true)
      returning id into acc_id;

      if r.quantity > 0 then
        insert into public.transactions (user_id, transaction_type, destination_account_id, asset_id, quantity, fiat_value, exchange_rate, execution_timestamp, note)
        values (u.uid, 'buy', acc_id, asset_id, r.quantity, r.quantity*r.avg_cost, r.avg_cost, r.created_at, 'Investment import');
      end if;
    end loop;

    -- migrate etfs
    for r in select * from public.etfs where user_id=u.uid loop
      insert into public.assets (user_id, symbol, name, asset_class, current_price, custom_asset)
      values (u.uid, coalesce(r.ticker, upper(left(r.name,6))), r.name, 'etf', r.current_price, true)
      on conflict (user_id, symbol) do update set current_price=excluded.current_price
      returning id into asset_id;

      insert into public.accounts (user_id, name, type, currency, current_balance)
      values (u.uid, r.name||' ETF', 'investment', 'USD', r.quantity*r.current_price)
      returning id into acc_id;

      if r.quantity > 0 then
        insert into public.transactions (user_id, transaction_type, destination_account_id, asset_id, quantity, fiat_value, exchange_rate, execution_timestamp, note)
        values (u.uid, 'buy', acc_id, asset_id, r.quantity, r.quantity*r.avg_cost, r.avg_cost, r.created_at, 'ETF import');
      end if;
    end loop;

    -- migrate crypto_holdings
    for r in select * from public.crypto_holdings where user_id=u.uid loop
      insert into public.assets (user_id, symbol, name, asset_class, current_price)
      values (u.uid, r.symbol, coalesce(r.name, r.symbol), 'crypto', r.current_price)
      on conflict (user_id, symbol) do update set current_price=excluded.current_price
      returning id into asset_id;

      insert into public.accounts (user_id, name, type, currency, current_balance)
      values (u.uid, r.symbol||' Wallet', 'crypto_wallet', 'USD', r.quantity*r.current_price)
      returning id into acc_id;

      if r.quantity > 0 then
        insert into public.transactions (user_id, transaction_type, destination_account_id, asset_id, quantity, fiat_value, exchange_rate, execution_timestamp, note)
        values (u.uid, 'buy', acc_id, asset_id, r.quantity, r.quantity*r.avg_cost, r.avg_cost, r.created_at, 'Crypto import');
      end if;
    end loop;
  end loop;
end $$;

-- =========================================================
-- handle_new_user: also seed default assets for new signups
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.trading_account (user_id) values (new.id);
  insert into public.onboarding_data (user_id) values (new.id);

  insert into public.assets (user_id, symbol, name, asset_class, color, current_price) values
    (new.id,'USD','US Dollar','fiat','#10b981',1),
    (new.id,'EUR','Euro','fiat','#3b82f6',1.08),
    (new.id,'BTC','Bitcoin','crypto','#f7931a',0),
    (new.id,'ETH','Ethereum','crypto','#627eea',0),
    (new.id,'SOL','Solana','crypto','#9945ff',0)
  on conflict (user_id, symbol) do nothing;

  return new;
end;
$$;

-- enable realtime
alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.assets;
alter publication supabase_realtime add table public.transactions;
