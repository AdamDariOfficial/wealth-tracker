begin;

select plan(21);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'v2_profiles', 'v2_accounts', 'v2_assets', 'v2_transactions',
     'v2_transaction_legs', 'v2_price_quotes', 'v2_fx_rates'
   ) and c.relkind = 'r'),
  7,
  'all seven Phase 2 v2 tables exist'
);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'v2_profiles', 'v2_accounts', 'v2_assets', 'v2_transactions',
     'v2_transaction_legs', 'v2_price_quotes', 'v2_fx_rates'
   ) and c.relkind = 'r' and c.relrowsecurity and c.relforcerowsecurity),
  7,
  'all seven Phase 2 v2 tables enable and force RLS'
);

select ok(
  (select bool_and(has_table_privilege('authenticated', format('public.%I', relname), 'SELECT'))
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'v2_profiles', 'v2_accounts', 'v2_assets', 'v2_transactions',
     'v2_transaction_legs', 'v2_price_quotes', 'v2_fx_rates'
   )),
  'authenticated has direct SELECT on every Phase 2 v2 table'
);

select ok(
  (select bool_and(
     not has_table_privilege('authenticated', format('public.%I', relname), 'INSERT')
     and not has_table_privilege('authenticated', format('public.%I', relname), 'UPDATE')
     and not has_table_privilege('authenticated', format('public.%I', relname), 'DELETE')
   )
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'v2_profiles', 'v2_accounts', 'v2_assets', 'v2_transactions',
     'v2_transaction_legs', 'v2_price_quotes', 'v2_fx_rates'
   )),
  'authenticated has no direct Phase 2 v2 write privileges'
);

select ok(
  (select bool_and(not has_table_privilege('anon', format('public.%I', relname), 'SELECT'))
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'v2_profiles', 'v2_accounts', 'v2_assets', 'v2_transactions',
     'v2_transaction_legs', 'v2_price_quotes', 'v2_fx_rates'
   )),
  'anon cannot read any Phase 2 v2 table'
);

select is(
  (select count(*)::integer from pg_policy p join pg_class c on c.oid = p.polrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'v2_profiles', 'v2_accounts', 'v2_assets', 'v2_transactions',
     'v2_transaction_legs', 'v2_price_quotes', 'v2_fx_rates'
   ) and p.polcmd = 'r'),
  7,
  'each Phase 2 v2 table has an explicit select policy'
);

select ok(
  (select count(*) = 7
     and bool_and(pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%')
   from pg_policy p
   join pg_class c on c.oid = p.polrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (
     'v2_profiles', 'v2_accounts', 'v2_assets', 'v2_transactions',
     'v2_transaction_legs', 'v2_price_quotes', 'v2_fx_rates'
   ) and p.polcmd = 'r'),
  'every Phase 2 v2 select policy scopes rows to auth.uid()'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'v2_transaction_legs_account_fk'
      and pg_get_constraintdef(oid) like '%(user_id, account_id)%'
  ),
  'transaction leg account foreign key includes ownership'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'v2_transaction_legs_asset_fk'
      and pg_get_constraintdef(oid) like '%(user_id, asset_id)%'
  ),
  'transaction leg asset foreign key includes ownership'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'v2_transactions_related_fk'
      and pg_get_constraintdef(oid) like '%(user_id, related_transaction_id)%'
  ),
  'transaction correction foreign key includes ownership'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'v2_price_quotes_asset_fk'
      and pg_get_constraintdef(oid) like '%(user_id, asset_id)%'
  ),
  'price quote asset foreign key includes ownership'
);

select ok(
  exists (
    select 1
    from pg_class idx
    join pg_index i on i.indexrelid = idx.oid
    join pg_class tbl on tbl.oid = i.indrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    where n.nspname = 'public'
      and tbl.relname = 'v2_transactions'
      and idx.relname = 'v2_transactions_one_reversal_idx'
      and i.indisunique
      and pg_get_expr(i.indpred, i.indrelid) like '%reversal%'
  ),
  'database enforces at most one reversal per target under concurrency'
);

select ok(
  exists (
    select 1
    from pg_class idx
    join pg_index i on i.indexrelid = idx.oid
    join pg_class tbl on tbl.oid = i.indrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    where n.nspname = 'public'
      and tbl.relname = 'v2_transactions'
      and idx.relname = 'v2_transactions_one_replacement_idx'
      and i.indisunique
      and pg_get_expr(i.indpred, i.indrelid) like '%replacement%'
  ),
  'database enforces at most one replacement per target under concurrency'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'v2_transactions_immutable' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname = 'v2_transaction_legs_immutable' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname = 'v2_price_quotes_immutable' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname = 'v2_fx_rates_immutable' and not tgisinternal),
  'all append-only financial history tables have immutable mutation triggers'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'v2_on_auth_user_created' and not tgisinternal),
  'auth user creation installs the v2 profile trigger'
);

select ok(
  not has_function_privilege('anon', 'public.v2_complete_onboarding(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_put_account(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_put_asset(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_post_transaction(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_append_price_quote(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_append_fx_rate(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_get_financial_state()', 'EXECUTE'),
  'anon cannot execute Phase 2 v2 RPC functions'
);

select ok(
  has_function_privilege('authenticated', 'public.v2_complete_onboarding(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_put_account(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_put_asset(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_post_transaction(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_append_price_quote(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_append_fx_rate(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_get_financial_state()', 'EXECUTE'),
  'authenticated can execute the reviewed Phase 2 v2 RPC surface'
);

select ok(
  (select count(*) = 6 and bool_and(p.prosecdef)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'v2_complete_onboarding', 'v2_put_account', 'v2_put_asset', 'v2_post_transaction',
     'v2_append_price_quote', 'v2_append_fx_rate'
   )),
  'all six Phase 2 v2 write RPCs are security definer functions'
);

select ok(
  (select count(*) = 6
     and bool_and(array_to_string(p.proconfig, ',') like '%search_path=public, pg_temp%')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'v2_complete_onboarding', 'v2_put_account', 'v2_put_asset', 'v2_post_transaction',
     'v2_append_price_quote', 'v2_append_fx_rate'
   )),
  'Phase 2 security definer RPCs pin search_path'
);

select ok(
  (select count(*) = 6
     and bool_and(pg_get_functiondef(p.oid) like '%pg_advisory_xact_lock%')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'v2_complete_onboarding', 'v2_put_account', 'v2_put_asset', 'v2_post_transaction',
     'v2_append_price_quote', 'v2_append_fx_rate'
   )),
  'every Phase 2 write RPC acquires the per-user transaction-scoped advisory lock'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'v2_get_financial_state'
      and not p.prosecdef
      and array_to_string(p.proconfig, ',') like '%search_path=public, pg_temp%'
  ),
  'Phase 2 read RPC is security invoker with a pinned search_path'
);

select * from finish();
rollback;
