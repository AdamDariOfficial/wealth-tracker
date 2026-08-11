begin;

select plan(39);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('33333333-3333-4333-8333-333333333333', 'phase4-a@example.test', '{}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', 'phase4-b@example.test', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select lives_ok(
  $$select public.v2_complete_onboarding('{"displayName":"Phase 4 A","baseCurrency":"EUR","locale":"it-IT"}'::jsonb)$$,
  'user A can onboard'
);

select lives_ok(
  $$select public.v2_put_account('{"id":"account:bank","name":"Bank","kind":"bank","ownership":"owned","includeInNetWorth":true,"openedAt":null,"archivedAt":null}'::jsonb)$$,
  'user A can create owned bank account'
);

select lives_ok(
  $$select public.v2_put_account('{"id":"account:income","name":"Income","kind":"income","ownership":"system","includeInNetWorth":false,"openedAt":null,"archivedAt":null}'::jsonb)$$,
  'user A can create system income account'
);

select lives_ok(
  $$select public.v2_put_asset('{"id":"asset:eur","symbol":"EUR","name":"Euro","kind":"fiat","precision":2,"fiatCurrency":"EUR"}'::jsonb)$$,
  'user A can create EUR asset'
);

select lives_ok(
  $$select public.v2_put_goal('{"id":"goal:nw","name":"Net worth","kind":"net_worth","targetAmount":"9007199254740993.01","targetQuantity":null,"targetAccountId":null,"targetAssetId":null,"targetDate":"2030-01-01"}'::jsonb)$$,
  'goal accepts exact target amount'
);

select lives_ok(
  $$select public.v2_put_asset('{"id":"asset:btc","symbol":"BTC","name":"Bitcoin","kind":"crypto","precision":8,"fiatCurrency":null}'::jsonb)$$,
  'user A can create BTC asset for quantity-goal precision tests'
);

select throws_ok(
  $$select public.v2_put_goal('{"id":"goal:btc-too-precise","name":"BTC precision","kind":"asset_quantity","targetAmount":null,"targetQuantity":"1.000000001","targetAccountId":null,"targetAssetId":"asset:btc","targetDate":null}'::jsonb)$$,
  'P0001',
  'goal target quantity exceeds asset precision',
  'asset quantity goal cannot exceed referenced asset precision'
);

select is(
  (public.v2_get_advanced_state() -> 'goals' -> 0 ->> 'targetAmount'),
  '9007199254740993.01',
  'goal target is returned as an exact decimal string'
);

select lives_ok(
  $$select public.v2_put_trading_settings('{"reserve":"123456789012345678.123456789012345678","defaultRiskPct":"1.25","weeklyLossLimitPct":"5.5","maxDailyLossPct":"2.25","primaryAsset":"NQ"}'::jsonb)$$,
  'trading settings accept exact decimal strings'
);

select is(
  (public.v2_get_advanced_state() -> 'tradingSettings' ->> 'reserve'),
  '123456789012345678.123456789012345678',
  'trading reserve is returned as an exact decimal string'
);

select lives_ok(
  $$select public.v2_put_weekly_review('{"id":"review:2026-08-03","weekStart":"2026-08-03","reportedPnl":"1234.56","winRate":"60.5","avgRr":"1.75","tradeCount":12,"maxDrawdownPct":"4.25","disciplineScore":80,"psychologyScore":70,"notes":"Good execution","lessons":"Keep risk fixed"}'::jsonb)$$,
  'weekly review can be saved as draft'
);

select lives_ok(
  $$select public.v2_finalize_weekly_review('review:2026-08-03')$$,
  'weekly review can be finalized'
);

select is(
  (select is_draft from public.v2_weekly_reviews where id = 'review:2026-08-03'),
  false,
  'finalized weekly review is no longer draft'
);

select throws_ok(
  $$select public.v2_put_weekly_review('{"id":"review:2026-08-03","weekStart":"2026-08-03","reportedPnl":"1","winRate":"1","avgRr":"1","tradeCount":1,"maxDrawdownPct":"1","disciplineScore":1,"psychologyScore":1,"notes":null,"lessons":null}'::jsonb)$$,
  'P0001',
  'finalized weekly reviews are immutable',
  'finalized weekly review cannot be edited'
);

select lives_ok(
  $$select public.v2_import_batch('{
    "id":"batch:salary",
    "label":"Salary import",
    "sourceText":"test import",
    "transactions":[{
      "id":"tx:import-salary",
      "occurredAt":"2026-08-10T08:00:00Z",
      "recordedAt":"2026-08-10T08:00:01Z",
      "description":"Imported salary",
      "purpose":"standard",
      "relatedTransactionId":null,
      "legs":[
        {"id":"leg:import-bank","accountId":"account:bank","assetId":"asset:eur","quantity":"2500.00","memo":null},
        {"id":"leg:import-income","accountId":"account:income","assetId":"asset:eur","quantity":"-2500.00","memo":null}
      ]
    }]
  }'::jsonb)$$,
  'valid import batch commits atomically'
);

select is(
  (select count(*)::integer from public.v2_import_batch_transactions where batch_id = 'batch:salary'),
  1,
  'import receipt links the posted transaction'
);

select throws_ok(
  $$select public.v2_import_batch('{
    "id":"batch:bad",
    "label":"Bad",
    "sourceText":"bad",
    "transactions":[{
      "id":"tx:bad-import",
      "occurredAt":"2026-08-10T09:00:00Z",
      "recordedAt":"2026-08-10T09:00:01Z",
      "description":"Bad import",
      "purpose":"standard",
      "relatedTransactionId":null,
      "legs":[
        {"id":"leg:bad-import-a","accountId":"account:bank","assetId":"asset:eur","quantity":"10.00","memo":null},
        {"id":"leg:bad-import-b","accountId":"account:income","assetId":"asset:eur","quantity":"-5.00","memo":null}
      ]
    }]
  }'::jsonb)$$,
  'P0001',
  'transaction legs are not balanced by asset',
  'invalid import aborts the entire batch'
);

select is(
  (select count(*)::integer from public.v2_import_batches where id = 'batch:bad'),
  0,
  'failed import leaves no receipt'
);

select is(
  (select count(*)::integer from public.v2_transactions where id = 'tx:bad-import'),
  0,
  'failed import leaves no partial transaction'
);

select lives_ok(
  $$select public.v2_rollback_import_batch('batch:salary')$$,
  'import rollback succeeds through reversal semantics'
);

select is(
  (select count(*)::integer
   from public.v2_transactions
   where purpose = 'reversal' and related_transaction_id = 'tx:import-salary'),
  1,
  'rollback creates one immutable reversal'
);

select is(
  (select count(*)::integer from public.v2_transactions where id = 'tx:import-salary'),
  1,
  'rollback preserves the original posted transaction'
);

select throws_ok(
  $$select public.v2_rollback_import_batch('batch:salary')$$,
  'P0001',
  'import batch already rolled back',
  'import rollback is one-way'
);

select is(
  (public.v2_export_backup() ->> 'schemaVersion')::integer,
  1,
  'backup is explicitly versioned'
);

select ok(
  (public.v2_export_backup() -> 'advancedState' -> 'importBatches' -> 0 ? 'sourceText'),
  'backup includes import source text and receipt metadata'
);

select set_config('phase4.backup', public.v2_export_backup()::text, true);

select throws_ok(
  $$select public.v2_reset_workspace('WRONG')$$,
  'P0001',
  'invalid reset confirmation',
  'reset requires exact destructive confirmation'
);

select lives_ok(
  $$select public.v2_reset_workspace('RESET WORKSPACE')$$,
  'confirmed reset clears the canonical workspace'
);

select is(
  (select count(*)::integer from public.v2_accounts),
  0,
  'reset clears financial entities'
);

select is(
  (select count(*)::integer from public.v2_goals),
  0,
  'reset clears advanced entities'
);

select is(
  (select count(*)::integer from public.v2_profiles),
  1,
  'reset preserves the authenticated profile'
);

select lives_ok(
  $$select public.v2_restore_backup(current_setting('phase4.backup')::jsonb)$$,
  'backup restores atomically'
);

select is(
  (select count(*)::integer from public.v2_accounts),
  2,
  'restore rebuilds financial entities'
);

select is(
  (select count(*)::integer from public.v2_goals),
  1,
  'restore rebuilds goals'
);

select is(
  (select count(*)::integer from public.v2_transactions),
  2,
  'restore preserves original and rollback reversal history'
);

select throws_ok(
  $$select public.v2_restore_backup(
    jsonb_set(
      current_setting('phase4.backup')::jsonb,
      '{financialState,transactions,0,legs,0,quantity}',
      '"999"'::jsonb
    )
  )$$,
  'P0001',
  'transaction legs are not balanced by asset',
  'invalid restore fails inside the atomic restore transaction'
);

select is(
  (select count(*)::integer from public.v2_transactions),
  2,
  'failed restore preserves the pre-existing canonical dataset'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);

select is((select count(*)::integer from public.v2_goals), 0, 'user B cannot read user A goals');
select is((select count(*)::integer from public.v2_weekly_reviews), 0, 'user B cannot read user A reviews');

select throws_ok(
  $$select public.v2_archive_goal('goal:nw')$$,
  'P0001',
  'goal not found',
  'user B cannot mutate user A goal through RPC'
);

select * from finish();
rollback;
