
-- DCA plans
create table if not exists public.dca_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_account_id uuid not null,
  destination_account_id uuid not null,
  asset_id uuid not null,
  amount_fiat numeric not null default 0,
  frequency text not null default 'monthly',
  next_run_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dca_plans enable row level security;
drop policy if exists "own dca plans" on public.dca_plans;
create policy "own dca plans" on public.dca_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists trg_dca_plans_updated on public.dca_plans;
create trigger trg_dca_plans_updated before update on public.dca_plans
  for each row execute function public.touch_updated_at();

-- Goals enhancements
do $$ begin
  create type public.goal_kind as enum ('net_worth','liquid','account_balance','asset_quantity','asset_value','custom');
exception when duplicate_object then null; end $$;

alter table public.goals
  add column if not exists kind public.goal_kind not null default 'custom',
  add column if not exists target_account_id uuid,
  add column if not exists target_asset_id uuid,
  add column if not exists target_quantity numeric;

-- Weekly reports linkage
alter table public.weekly_reports
  add column if not exists posted_transaction_id uuid,
  add column if not exists broker_account_id uuid;

-- Indexes for transactions
create index if not exists idx_tx_user_ts on public.transactions(user_id, execution_timestamp desc);
create index if not exists idx_tx_user_asset on public.transactions(user_id, asset_id);
create index if not exists idx_tx_user_src on public.transactions(user_id, source_account_id);
create index if not exists idx_tx_user_dst on public.transactions(user_id, destination_account_id);

-- Recompute account balance from ledger
create or replace function public.recompute_account_balance(_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare bal numeric := 0;
begin
  if _account_id is null then return; end if;
  select coalesce(sum(case
    when t.transaction_type in ('deposit','interest','dividend','staking_reward','profit_realization')
         and t.destination_account_id = _account_id then t.fiat_value
    when t.transaction_type in ('withdrawal','fee')
         and t.source_account_id = _account_id then -t.fiat_value
    when t.transaction_type = 'buy' and t.source_account_id = _account_id then -t.fiat_value
    when t.transaction_type = 'sell' and t.destination_account_id = _account_id then t.fiat_value
    when t.transaction_type = 'transfer' and t.source_account_id = _account_id then -t.fiat_value
    when t.transaction_type = 'transfer' and t.destination_account_id = _account_id then t.fiat_value
    when t.transaction_type = 'manual_adjustment' and t.destination_account_id = _account_id then t.fiat_value
    else 0 end),0) into bal
  from public.transactions t
  where t.user_id = (select user_id from public.accounts where id = _account_id);
  update public.accounts set current_balance = bal, updated_at = now() where id = _account_id;
end $$;

create or replace function public.tg_tx_recompute()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_account_balance(old.source_account_id);
    perform public.recompute_account_balance(old.destination_account_id);
    return old;
  end if;
  perform public.recompute_account_balance(new.source_account_id);
  perform public.recompute_account_balance(new.destination_account_id);
  if tg_op = 'UPDATE' then
    if new.source_account_id is distinct from old.source_account_id then
      perform public.recompute_account_balance(old.source_account_id);
    end if;
    if new.destination_account_id is distinct from old.destination_account_id then
      perform public.recompute_account_balance(old.destination_account_id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_tx_recompute on public.transactions;
create trigger trg_tx_recompute
after insert or update or delete on public.transactions
for each row execute function public.tg_tx_recompute();
