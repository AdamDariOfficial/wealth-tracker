-- 1. Transactions: soft delete + transfer pairing
alter table public.transactions
  add column if not exists voided_at timestamptz,
  add column if not exists voided_reason text,
  add column if not exists transfer_group_id uuid;

create index if not exists idx_transactions_transfer_group
  on public.transactions(transfer_group_id)
  where transfer_group_id is not null;

create index if not exists idx_transactions_user_active
  on public.transactions(user_id, execution_timestamp desc)
  where voided_at is null;

-- 2. Soft-delete columns on assets and goals
alter table public.assets add column if not exists archived_at timestamptz;
alter table public.goals  add column if not exists archived_at timestamptz;

-- 3. Voided-aware reconciliation
create or replace function public.recompute_account_balance(_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
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
  where t.user_id = uid
    and t.voided_at is null;

  if prev is distinct from bal then
    update public.accounts set current_balance = bal, updated_at = now() where id = _account_id;
    insert into public.audit_log(user_id, event_type, account_id, before_balance, after_balance, delta, source, message)
      values (uid, 'reconciliation', _account_id, prev, bal, bal - coalesce(prev,0), 'trigger',
              'Balance recomputed from ledger');
  end if;
end $function$;

-- 4. Audit trail foundation — generic entity change-capture
alter table public.audit_log
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists diff jsonb;

create or replace function public.tg_audit_entity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  uid uuid;
  ev text;
  ent text := tg_table_name;
  rid uuid;
  changed jsonb;
  tx_id uuid;
begin
  if tg_op = 'INSERT' then
    uid := new.user_id; rid := new.id; ev := ent || '_created';
    changed := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    uid := new.user_id; rid := new.id; ev := ent || '_updated';
    select jsonb_object_agg(k, jsonb_build_object('from', (to_jsonb(old)->k), 'to', (to_jsonb(new)->k)))
      into changed
      from jsonb_object_keys(to_jsonb(new)) as k
      where (to_jsonb(new)->k) is distinct from (to_jsonb(old)->k)
        and k not in ('updated_at');
    if changed is null then return new; end if;
  else -- DELETE
    uid := old.user_id; rid := old.id; ev := ent || '_deleted';
    changed := to_jsonb(old);
  end if;

  tx_id := case when ent = 'transactions' then rid else null end;

  insert into public.audit_log(user_id, event_type, entity_type, entity_id, transaction_id, source, message, diff)
    values (uid, ev, ent, rid, tx_id, 'trigger', ev, changed);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

drop trigger if exists trg_audit_transactions on public.transactions;
create trigger trg_audit_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.tg_audit_entity();

drop trigger if exists trg_audit_accounts on public.accounts;
create trigger trg_audit_accounts
  after insert or update or delete on public.accounts
  for each row execute function public.tg_audit_entity();

drop trigger if exists trg_audit_assets on public.assets;
create trigger trg_audit_assets
  after insert or update or delete on public.assets
  for each row execute function public.tg_audit_entity();

drop trigger if exists trg_audit_goals on public.goals;
create trigger trg_audit_goals
  after insert or update or delete on public.goals
  for each row execute function public.tg_audit_entity();

-- Re-attach the recompute trigger reference (ensure it still exists & fires on voided_at flips via UPDATE)
drop trigger if exists trg_tx_recompute on public.transactions;
create trigger trg_tx_recompute
  after insert or update or delete on public.transactions
  for each row execute function public.tg_tx_recompute();