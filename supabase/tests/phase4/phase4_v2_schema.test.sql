begin;

select plan(18);

select is(
  (select count(*)::integer
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'v2_goals',
       'v2_trading_settings',
       'v2_weekly_reviews',
       'v2_import_batches',
       'v2_import_batch_transactions'
     )
     and c.relkind = 'r'),
  5,
  'all five Phase 4 v2 tables exist'
);

select is(
  (select count(*)::integer
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'v2_goals',
       'v2_trading_settings',
       'v2_weekly_reviews',
       'v2_import_batches',
       'v2_import_batch_transactions'
     )
     and c.relrowsecurity
     and c.relforcerowsecurity),
  5,
  'all Phase 4 tables enable and force RLS'
);

select ok(
  (select bool_and(has_table_privilege('authenticated', format('public.%I', relname), 'SELECT'))
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'v2_goals',
       'v2_trading_settings',
       'v2_weekly_reviews',
       'v2_import_batches',
       'v2_import_batch_transactions'
     )),
  'authenticated can read every Phase 4 v2 table'
);

select ok(
  (select bool_and(
     not has_table_privilege('authenticated', format('public.%I', relname), 'INSERT')
     and not has_table_privilege('authenticated', format('public.%I', relname), 'UPDATE')
     and not has_table_privilege('authenticated', format('public.%I', relname), 'DELETE')
   )
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'v2_goals',
       'v2_trading_settings',
       'v2_weekly_reviews',
       'v2_import_batches',
       'v2_import_batch_transactions'
     )),
  'authenticated has no direct Phase 4 writes'
);

select ok(
  (select bool_and(not has_table_privilege('anon', format('public.%I', relname), 'SELECT'))
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'v2_goals',
       'v2_trading_settings',
       'v2_weekly_reviews',
       'v2_import_batches',
       'v2_import_batch_transactions'
     )),
  'anon cannot read Phase 4 tables'
);

select is(
  (select count(*)::integer
   from pg_policy p
   join pg_class c on c.oid = p.polrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'v2_goals',
       'v2_trading_settings',
       'v2_weekly_reviews',
       'v2_import_batches',
       'v2_import_batch_transactions'
     )
     and p.polcmd = 'r'
     and pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%'),
  5,
  'every Phase 4 read policy is scoped to auth.uid()'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'v2_goals_account_fk'
      and pg_get_constraintdef(oid) like '%(user_id, target_account_id)%'
  )
  and exists (
    select 1 from pg_constraint
    where conname = 'v2_goals_asset_fk'
      and pg_get_constraintdef(oid) like '%(user_id, target_asset_id)%'
  ),
  'goal references preserve same-user ownership'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'v2_import_batch_transactions_batch_fk'
      and pg_get_constraintdef(oid) like '%(user_id, batch_id)%'
  )
  and exists (
    select 1 from pg_constraint
    where conname = 'v2_import_batch_transactions_transaction_fk'
      and pg_get_constraintdef(oid) like '%(user_id, transaction_id)%'
  ),
  'import receipt references preserve same-user ownership'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'v2_weekly_reviews_guard' and not tgisinternal
  ),
  'weekly reviews have an immutable-finalization guard'
);

select ok(
  pg_get_functiondef('public.v2_reject_immutable_mutation()'::regprocedure)
    like '%nebula.v2_maintenance%',
  'financial immutable trigger exposes only the controlled maintenance escape used by restore/reset'
);

select ok(
  not has_function_privilege('anon', 'public.v2_get_advanced_state()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_put_goal(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_archive_goal(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_put_trading_settings(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_put_weekly_review(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_finalize_weekly_review(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_delete_weekly_review(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_import_batch(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_rollback_import_batch(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_export_backup()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_restore_backup(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.v2_reset_workspace(text)', 'EXECUTE'),
  'anon cannot execute the Phase 4 RPC surface'
);

select ok(
  has_function_privilege('authenticated', 'public.v2_get_advanced_state()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_put_goal(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_archive_goal(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_put_trading_settings(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_put_weekly_review(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_finalize_weekly_review(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_delete_weekly_review(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_import_batch(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_rollback_import_batch(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_export_backup()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_restore_backup(jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.v2_reset_workspace(text)', 'EXECUTE'),
  'authenticated can execute the reviewed Phase 4 RPC surface'
);

select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'v2_put_goal',
       'v2_archive_goal',
       'v2_put_trading_settings',
       'v2_put_weekly_review',
       'v2_finalize_weekly_review',
       'v2_delete_weekly_review',
       'v2_import_batch',
       'v2_rollback_import_batch',
       'v2_restore_backup',
       'v2_reset_workspace'
     )
     and p.prosecdef),
  10,
  'all ten Phase 4 write RPCs are security definer'
);

select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'v2_put_goal',
       'v2_archive_goal',
       'v2_put_trading_settings',
       'v2_put_weekly_review',
       'v2_finalize_weekly_review',
       'v2_delete_weekly_review',
       'v2_import_batch',
       'v2_rollback_import_batch',
       'v2_restore_backup',
       'v2_reset_workspace'
     )
     and pg_get_functiondef(p.oid) like '%pg_advisory_xact_lock%'),
  10,
  'every Phase 4 write RPC acquires the per-user advisory lock'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'v2_get_advanced_state'
      and not p.prosecdef
  )
  and exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'v2_export_backup'
      and not p.prosecdef
  ),
  'Phase 4 read RPCs are security invoker'
);

select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'v2_get_advanced_state',
       'v2_put_goal',
       'v2_archive_goal',
       'v2_put_trading_settings',
       'v2_put_weekly_review',
       'v2_finalize_weekly_review',
       'v2_delete_weekly_review',
       'v2_import_batch',
       'v2_rollback_import_batch',
       'v2_export_backup',
       'v2_restore_backup',
       'v2_reset_workspace'
     )
     and array_to_string(p.proconfig, ',') like '%search_path=public, pg_temp%'),
  12,
  'all Phase 4 RPCs pin search_path'
);

select ok(
  (select data_type = 'numeric'
   from information_schema.columns
   where table_schema = 'public' and table_name = 'v2_goals' and column_name = 'target_amount')
  and
  (select data_type = 'numeric'
   from information_schema.columns
   where table_schema = 'public' and table_name = 'v2_weekly_reviews' and column_name = 'reported_pnl')
  and
  (select data_type = 'numeric'
   from information_schema.columns
   where table_schema = 'public' and table_name = 'v2_trading_settings' and column_name = 'reserve'),
  'Phase 4 financial decimals use PostgreSQL numeric'
);

select ok(
  pg_get_functiondef('public.v2_restore_backup(jsonb)'::regprocedure)
    like '%set_config(''nebula.v2_maintenance'', ''on'', true)%'
  and pg_get_functiondef('public.v2_reset_workspace(text)'::regprocedure)
    like '%set_config(''nebula.v2_maintenance'', ''on'', true)%',
  'only reviewed destructive RPCs opt into maintenance mode'
);

select * from finish();
rollback;
