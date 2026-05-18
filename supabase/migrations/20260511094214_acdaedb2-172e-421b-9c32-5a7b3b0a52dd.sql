
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  currency text not null default 'USD',
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Onboarding data (JSON-flexible)
create table public.onboarding_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  financial jsonb not null default '{}'::jsonb,
  investment jsonb not null default '{}'::jsonb,
  trading jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.onboarding_data enable row level security;
create policy "own onboarding all" on public.onboarding_data for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Investments
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ticker text,
  asset_class text not null default 'stock',
  quantity numeric not null default 0,
  avg_cost numeric not null default 0,
  current_price numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.investments enable row level security;
create policy "own investments" on public.investments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.investments(user_id);

-- ETFs
create table public.etfs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ticker text,
  quantity numeric not null default 0,
  avg_cost numeric not null default 0,
  current_price numeric not null default 0,
  monthly_contribution numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.etfs enable row level security;
create policy "own etfs" on public.etfs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.etfs(user_id);

-- Crypto
create table public.crypto_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text,
  quantity numeric not null default 0,
  avg_cost numeric not null default 0,
  current_price numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crypto_holdings enable row level security;
create policy "own crypto" on public.crypto_holdings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.crypto_holdings(user_id);

-- Goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text default 'general',
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.goals enable row level security;
create policy "own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.goals(user_id);

-- Cash reserves
create table public.cash_reserves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  purpose text,
  balance numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cash_reserves enable row level security;
create policy "own reserves" on public.cash_reserves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.cash_reserves(user_id);

-- Trading account
create table public.trading_account (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric not null default 0,
  reserve numeric not null default 0,
  max_daily_loss_pct numeric not null default 2,
  weekly_loss_limit_pct numeric not null default 5,
  default_risk_pct numeric not null default 1,
  primary_asset text,
  updated_at timestamptz not null default now()
);
alter table public.trading_account enable row level security;
create policy "own trading account" on public.trading_account for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Weekly reports (core trading performance system)
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  pnl numeric not null default 0,
  winrate numeric not null default 0,
  avg_rr numeric not null default 0,
  num_trades int not null default 0,
  max_drawdown numeric not null default 0,
  discipline_score int not null default 0,
  psychology_score int not null default 0,
  consistency_score int not null default 0,
  notes text,
  lessons text,
  screenshots text[] not null default '{}',
  is_draft boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
alter table public.weekly_reports enable row level security;
create policy "own weekly" on public.weekly_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.weekly_reports(user_id, week_start desc);

-- Trade vault (optional)
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_date date not null default current_date,
  asset text not null,
  direction text not null default 'Long',
  setup text,
  entry numeric,
  stop_loss numeric,
  take_profit numeric,
  rr numeric,
  pnl numeric not null default 0,
  rating int not null default 3,
  session text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.trades enable row level security;
create policy "own trades" on public.trades for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.trades(user_id, trade_date desc);

-- Performance snapshots (net worth time series)
create table public.performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  net_worth numeric not null default 0,
  investments_value numeric not null default 0,
  crypto_value numeric not null default 0,
  trading_value numeric not null default 0,
  cash_value numeric not null default 0,
  unique (user_id, snapshot_date)
);
alter table public.performance_snapshots enable row level security;
create policy "own snapshots" on public.performance_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

do $$ declare t text;
begin
  for t in select unnest(array['profiles','investments','etfs','crypto_holdings','goals','cash_reserves','trading_account','weekly_reports','onboarding_data']) loop
    execute format('create trigger trg_%s_updated before update on public.%s for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;

-- Auto-create profile + trading account on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.trading_account (user_id) values (new.id);
  insert into public.onboarding_data (user_id) values (new.id);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Enable realtime
alter publication supabase_realtime add table public.investments;
alter publication supabase_realtime add table public.etfs;
alter publication supabase_realtime add table public.crypto_holdings;
alter publication supabase_realtime add table public.goals;
alter publication supabase_realtime add table public.cash_reserves;
alter publication supabase_realtime add table public.trading_account;
alter publication supabase_realtime add table public.weekly_reports;
alter publication supabase_realtime add table public.trades;
