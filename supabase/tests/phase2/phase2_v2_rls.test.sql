begin;

select plan(41);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'phase2-a@example.test', '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'phase2-b@example.test', '{}'::jsonb);

select is(
  (select count(*)::integer from public.v2_profiles where user_id in (
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  )),
  2,
  'auth trigger creates v2 profile shells'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is((select count(*)::integer from public.v2_profiles), 1, 'user A sees only own profile');

select lives_ok(
  $$select public.v2_complete_onboarding('{"displayName":"User A","baseCurrency":"EUR","locale":"it-IT"}'::jsonb)$$,
  'user A can complete own onboarding'
);

select lives_ok(
  $$select public.v2_put_account('{"id":"account:owned","name":"Owned","kind":"bank","ownership":"owned","includeInNetWorth":true,"openedAt":null,"archivedAt":null}'::jsonb)$$,
  'user A can create owned account through RPC'
);

select lives_ok(
  $$select public.v2_put_account('{"id":"account:external","name":"External","kind":"external","ownership":"external","includeInNetWorth":false,"openedAt":null,"archivedAt":null}'::jsonb)$$,
  'user A can create external balancing account through RPC'
);

select lives_ok(
  $$select public.v2_put_asset('{"id":"asset:eur","symbol":"EUR","name":"Euro","kind":"fiat","precision":2,"fiatCurrency":"EUR"}'::jsonb)$$,
  'user A can create fiat asset through RPC'
);

select lives_ok(
  $$select public.v2_post_transaction('{"id":"tx:exact","occurredAt":"2026-08-01T10:00:00Z","recordedAt":"2026-08-01T10:00:01Z","description":"Exact value","purpose":"standard","relatedTransactionId":null,"legs":[{"id":"leg:owned","accountId":"account:owned","assetId":"asset:eur","quantity":"9007199254740993.01","memo":null},{"id":"leg:external","accountId":"account:external","assetId":"asset:eur","quantity":"-9007199254740993.01","memo":null}]}'::jsonb)$$,
  'balanced transaction posts atomically'
);

select is(
  (select quantity::text from public.v2_transaction_legs where id = 'leg:owned'),
  '9007199254740993.01',
  'numeric quantity remains exact beyond JavaScript safe integer range'
);

select lives_ok(
  $$select public.v2_post_transaction('{"id":"tx:reverse-exact","occurredAt":"2026-08-01T10:00:00Z","recordedAt":"2026-08-01T10:00:02Z","description":"Reverse exact value","purpose":"reversal","relatedTransactionId":"tx:exact","legs":[{"id":"leg:reverse-owned","accountId":"account:owned","assetId":"asset:eur","quantity":"-9007199254740993.01","memo":null},{"id":"leg:reverse-external","accountId":"account:external","assetId":"asset:eur","quantity":"9007199254740993.01","memo":null}]}'::jsonb)$$,
  'exact reversal with preserved economic timestamp is accepted'
);

select throws_ok(
  $$select public.v2_post_transaction('{"id":"tx:second-reversal","occurredAt":"2026-08-01T10:00:00Z","recordedAt":"2026-08-01T10:00:03Z","description":"Duplicate reversal","purpose":"reversal","relatedTransactionId":"tx:exact","legs":[{"id":"leg:second-reverse-owned","accountId":"account:owned","assetId":"asset:eur","quantity":"-9007199254740993.01","memo":null},{"id":"leg:second-reverse-external","accountId":"account:external","assetId":"asset:eur","quantity":"9007199254740993.01","memo":null}]}'::jsonb)$$,
  'P0001',
  'target already has a reversal',
  'a target cannot receive a second reversal'
);

select lives_ok(
  $$select public.v2_post_transaction('{"id":"tx:replacement","occurredAt":"2026-08-01T10:00:00Z","recordedAt":"2026-08-01T10:00:04Z","description":"Replacement value","purpose":"replacement","relatedTransactionId":"tx:exact","legs":[{"id":"leg:replacement-owned","accountId":"account:owned","assetId":"asset:eur","quantity":"50.00","memo":null},{"id":"leg:replacement-external","accountId":"account:external","assetId":"asset:eur","quantity":"-50.00","memo":null}]}'::jsonb)$$,
  'replacement is accepted only after the target reversal exists'
);

select throws_ok(
  $$select public.v2_post_transaction('{"id":"tx:second-replacement","occurredAt":"2026-08-01T10:00:00Z","recordedAt":"2026-08-01T10:00:05Z","description":"Duplicate replacement","purpose":"replacement","relatedTransactionId":"tx:exact","legs":[{"id":"leg:second-replacement-owned","accountId":"account:owned","assetId":"asset:eur","quantity":"25.00","memo":null},{"id":"leg:second-replacement-external","accountId":"account:external","assetId":"asset:eur","quantity":"-25.00","memo":null}]}'::jsonb)$$,
  'P0001',
  'target already has a replacement',
  'a target cannot receive a second replacement'
);

select throws_ok(
  $$insert into public.v2_accounts (user_id,id,name,kind,ownership,include_in_net_worth) values ('11111111-1111-4111-8111-111111111111','account:direct','Direct','bank','owned',true)$$,
  '42501',
  null,
  'direct account insert is denied'
);

select throws_ok(
  $$update public.v2_transactions set description = 'Changed' where id = 'tx:exact'$$,
  '42501',
  null,
  'direct transaction update is denied'
);

select throws_ok(
  $$select public.v2_post_transaction('{"id":"tx:unbalanced","occurredAt":"2026-08-02T10:00:00Z","recordedAt":"2026-08-02T10:00:01Z","description":"Bad","purpose":"standard","relatedTransactionId":null,"legs":[{"id":"leg:bad-a","accountId":"account:owned","assetId":"asset:eur","quantity":"1.00","memo":null},{"id":"leg:bad-b","accountId":"account:external","assetId":"asset:eur","quantity":"-0.50","memo":null}]}'::jsonb)$$,
  'P0001',
  'transaction legs are not balanced by asset',
  'unbalanced transaction is rejected'
);

select is(
  (select count(*)::integer from public.v2_transactions where id = 'tx:unbalanced'),
  0,
  'failed transaction leaves no partial transaction row'
);

select throws_ok(
  $$select public.v2_post_transaction('{"id":"tx:bad-time","occurredAt":"2026-08-02 10:00:00","recordedAt":"2026-08-02T10:00:01Z","description":"Bad time","purpose":"standard","relatedTransactionId":null,"legs":[{"id":"leg:time-a","accountId":"account:owned","assetId":"asset:eur","quantity":"1.00","memo":null},{"id":"leg:time-b","accountId":"account:external","assetId":"asset:eur","quantity":"-1.00","memo":null}]}'::jsonb)$$,
  'P0001',
  'occurredAt must be an explicit ISO-8601 instant',
  'timestamps without an explicit offset are rejected'
);

select is(
  (select count(*)::integer from public.v2_transactions where id = 'tx:bad-time'),
  0,
  'rejected timestamp leaves no partial transaction row'
);

select throws_ok(
  $$select public.v2_put_account('{"id":"account:owned","name":"Owned","kind":"bank","ownership":"owned","includeInNetWorth":true,"openedAt":null,"archivedAt":"2026-07-31T00:00:00Z"}'::jsonb)$$,
  'P0001',
  'account lifecycle would exclude existing transaction history',
  'account lifecycle cannot be changed across existing history'
);

select is(
  (select archived_at is null from public.v2_accounts where id = 'account:owned'),
  true,
  'failed account lifecycle mutation leaves the stored account unchanged'
);

select throws_ok(
  $$select public.v2_put_asset('{"id":"asset:eur","symbol":"EUR","name":"Euro","kind":"fiat","precision":1,"fiatCurrency":"EUR"}'::jsonb)$$,
  'P0001',
  'asset precision would invalidate existing transaction quantities',
  'asset precision cannot be lowered below existing ledger quantities'
);

select is(
  (select precision::integer from public.v2_assets where id = 'asset:eur'),
  2,
  'failed asset precision mutation leaves stored precision unchanged'
);

select throws_ok(
  $$select public.v2_append_price_quote('{"assetId":"asset:eur","amount":"1","currency":"EUR","asOf":"2026-08-04T09:00:00Z"}'::jsonb)$$,
  'P0001',
  'fiat assets cannot receive price quotes',
  'database rejects price quotes for fiat assets'
);

select lives_ok(
  $$select public.v2_put_asset('{"id":"asset:btc","symbol":"BTC","name":"Bitcoin","kind":"crypto","precision":8,"fiatCurrency":null}'::jsonb)$$,
  'user A can create non-fiat asset'
);

select lives_ok(
  $$select public.v2_append_price_quote('{"assetId":"asset:btc","amount":"123456789012345678.12345678","currency":"EUR","asOf":"2026-08-04T10:00:00Z"}'::jsonb)$$,
  'price quote accepts exact decimal string'
);

select is(
  (public.v2_get_financial_state() -> 'priceQuotes' -> 0 ->> 'amount'),
  '123456789012345678.12345678',
  'read RPC returns canonical numeric price as text'
);

select lives_ok(
  $$select public.v2_append_fx_rate('{"sourceCurrency":"USD","targetCurrency":"EUR","rate":"123456789012345678.123456789012345678","asOf":"2026-08-04T10:00:00Z"}'::jsonb)$$,
  'FX rate accepts exact decimal string'
);

select is(
  (public.v2_get_financial_state() -> 'fxRates' -> 0 ->> 'rate'),
  '123456789012345678.123456789012345678',
  'read RPC returns canonical numeric FX rate as text'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

select is((select count(*)::integer from public.v2_profiles), 1, 'user B sees only own profile');
select is((select count(*)::integer from public.v2_accounts), 0, 'user B cannot see user A accounts');
select is((select count(*)::integer from public.v2_assets), 0, 'user B cannot see user A assets');
select is((select count(*)::integer from public.v2_transactions), 0, 'user B cannot see user A transactions');
select is((select count(*)::integer from public.v2_transaction_legs), 0, 'user B cannot see user A transaction legs');
select is((select count(*)::integer from public.v2_price_quotes), 0, 'user B cannot see user A price quotes');
select is((select count(*)::integer from public.v2_fx_rates), 0, 'user B cannot see user A FX rates');

select lives_ok(
  $$select public.v2_put_account('{"id":"account:user-b","name":"User B","kind":"bank","ownership":"owned","includeInNetWorth":true,"openedAt":null,"archivedAt":null}'::jsonb)$$,
  'user B can create own account'
);

select lives_ok(
  $$select public.v2_put_asset('{"id":"asset:user-b","symbol":"USB","name":"User B Asset","kind":"other","precision":4,"fiatCurrency":null}'::jsonb)$$,
  'user B can create own asset'
);

select lives_ok(
  $$select public.v2_put_account('{"id":"account:owned","name":"B Shadow","kind":"bank","ownership":"owned","includeInNetWorth":true,"openedAt":null,"archivedAt":null}'::jsonb)$$,
  'same text account ID creates an isolated user B row instead of mutating user A'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (select name from public.v2_accounts where id = 'account:owned'),
  'Owned',
  'user B same-ID write did not mutate user A account'
);

select throws_ok(
  $$select public.v2_post_transaction('{"id":"tx:cross-user-account","occurredAt":"2026-08-03T10:00:00Z","recordedAt":"2026-08-03T10:00:01Z","description":"Cross user account","purpose":"standard","relatedTransactionId":null,"legs":[{"id":"leg:cross-account-a","accountId":"account:user-b","assetId":"asset:eur","quantity":"1.00","memo":null},{"id":"leg:cross-account-b","accountId":"account:external","assetId":"asset:eur","quantity":"-1.00","memo":null}]}'::jsonb)$$,
  'P0001',
  'transaction references unknown account',
  'cross-user account reference is rejected'
);

select throws_ok(
  $$select public.v2_post_transaction('{"id":"tx:cross-user-asset","occurredAt":"2026-08-03T10:00:00Z","recordedAt":"2026-08-03T10:00:01Z","description":"Cross user asset","purpose":"standard","relatedTransactionId":null,"legs":[{"id":"leg:cross-asset-a","accountId":"account:owned","assetId":"asset:user-b","quantity":"1.0000","memo":null},{"id":"leg:cross-asset-b","accountId":"account:external","assetId":"asset:user-b","quantity":"-1.0000","memo":null}]}'::jsonb)$$,
  'P0001',
  'transaction references unknown asset or exceeds asset precision',
  'cross-user asset reference is rejected'
);

select * from finish();
rollback;
