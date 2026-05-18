
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  account_id uuid,
  transaction_id uuid,
  before_balance numeric,
  after_balance numeric,
  delta numeric,
  source text NOT NULL DEFAULT 'system',
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own audit" ON public.audit_log;
CREATE POLICY "own audit" ON public.audit_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_audit_user_time   ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_event  ON public.audit_log (user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_acct   ON public.audit_log (user_id, account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_tx     ON public.audit_log (user_id, transaction_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;

-- Helpful tx indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_tx_user_time   ON public.transactions (user_id, execution_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user_asset  ON public.transactions (user_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_tx_user_src    ON public.transactions (user_id, source_account_id);
CREATE INDEX IF NOT EXISTS idx_tx_user_dst    ON public.transactions (user_id, destination_account_id);

-- Upgrade recompute to log balance reconciliations.
CREATE OR REPLACE FUNCTION public.recompute_account_balance(_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
         and t.destination_account_id = _account_id then t.fiat_value
    when t.transaction_type in ('withdrawal','fee')
         and t.source_account_id = _account_id then -t.fiat_value
    when t.transaction_type = 'buy' and t.source_account_id = _account_id then -t.fiat_value
    when t.transaction_type = 'sell' and t.destination_account_id = _account_id then t.fiat_value
    when t.transaction_type = 'transfer' and t.source_account_id = _account_id then -t.fiat_value
    when t.transaction_type = 'transfer' and t.destination_account_id = _account_id then t.fiat_value
    when t.transaction_type = 'manual_adjustment' and t.destination_account_id = _account_id then t.fiat_value
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
end $function$;

-- Recreate trigger on transactions to call recompute (was orphaned).
DROP TRIGGER IF EXISTS tg_transactions_recompute ON public.transactions;
CREATE TRIGGER tg_transactions_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_tx_recompute();
