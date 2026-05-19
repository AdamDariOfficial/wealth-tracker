
create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  base text not null,
  quote text not null,
  rate numeric not null check (rate > 0),
  as_of timestamptz not null default now(),
  as_of_date date generated always as ((as_of at time zone 'UTC')::date) stored,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create unique index if not exists fx_rates_base_quote_day
  on public.fx_rates (base, quote, as_of_date);

create index if not exists fx_rates_lookup
  on public.fx_rates (base, quote, as_of desc);

alter table public.fx_rates enable row level security;

drop policy if exists "fx rates readable" on public.fx_rates;
create policy "fx rates readable"
  on public.fx_rates for select
  to authenticated
  using (true);

alter table public.transactions
  add column if not exists asset_price     numeric,
  add column if not exists asset_currency  text,
  add column if not exists base_currency   text,
  add column if not exists base_value      numeric,
  add column if not exists fee_base_value  numeric;

update public.transactions t
set
  base_value     = coalesce(t.base_value, t.fiat_value),
  base_currency  = coalesce(t.base_currency, p.currency, 'USD'),
  asset_currency = coalesce(t.asset_currency, p.currency, 'USD'),
  asset_price    = coalesce(t.asset_price,
                    case when t.quantity is not null and t.quantity <> 0
                         then t.fiat_value / t.quantity end),
  fee_base_value = coalesce(t.fee_base_value, t.fee_amount)
from public.profiles p
where p.id = t.user_id;

create index if not exists tx_user_exec_idx
  on public.transactions (user_id, execution_timestamp desc);

create index if not exists tx_src_acct_idx on public.transactions (source_account_id);
create index if not exists tx_dst_acct_idx on public.transactions (destination_account_id);

create or replace function public.recompute_account_balance(_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bal numeric := 0;
  prev numeric;
  uid uuid;
begin
  if _account_id is null then return; end if;

  select user_id, current_balance into uid, prev
  from public.accounts where id = _account_id;
  if uid is null then return; end if;

  select coalesce(sum(case
    when t.transaction_type in ('deposit','interest','dividend','staking_reward','profit_realization')
         and t.destination_account_id = _account_id then coalesce(t.base_value, t.fiat_value)
    when t.transaction_type in ('withdrawal','fee')
         and t.source_account_id = _account_id then -coalesce(t.base_value, t.fiat_value)
    when t.transaction_type = 'buy' and t.source_account_id = _account_id then -coalesce(t.base_value, t.fiat_value)
    when t.transaction_type = 'sell' and t.destination_account_id = _account_id then coalesce(t.base_value, t.fiat_value)
    when t.transaction_type = 'transfer' and t.source_account_id = _account_id then -coalesce(t.base_value, t.fiat_value)
    when t.transaction_type = 'transfer' and t.destination_account_id = _account_id then coalesce(t.base_value, t.fiat_value)
    when t.transaction_type = 'manual_adjustment' and t.destination_account_id = _account_id then coalesce(t.base_value, t.fiat_value)
    else 0 end),0)
  into bal
  from public.transactions t
  where t.user_id = uid;

  if prev is distinct from bal then
    update public.accounts set current_balance = bal, updated_at = now() where id = _account_id;
    insert into public.audit_log(user_id, event_type, account_id, before_balance, after_balance, delta, source, message)
      values (uid, 'reconciliation', _account_id, prev, bal, bal - coalesce(prev,0), 'trigger',
              'Balance recomputed from ledger');
  end if;
end $$;
