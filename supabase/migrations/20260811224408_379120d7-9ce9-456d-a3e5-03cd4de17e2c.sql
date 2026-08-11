-- Nebula Wealth Hub Phase 2: additive v2 persistence foundation.
-- Legacy tables and migrations are intentionally untouched.

create table public.v2_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency text,
  locale text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_profiles_display_name_check check (
    display_name is null
    or (display_name = btrim(display_name) and char_length(display_name) between 1 and 120)
  ),
  constraint v2_profiles_base_currency_check check (
    base_currency is null or base_currency ~ '^[A-Z]{3}$'
  ),
  constraint v2_profiles_locale_check check (
    locale is null
    or (locale = btrim(locale) and char_length(locale) <= 35 and locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$')
  ),
  constraint v2_profiles_onboarding_check check (
    not onboarded or (base_currency is not null and locale is not null)
  )
);

create table public.v2_accounts (
  user_id uuid not null references public.v2_profiles(user_id) on delete cascade,
  id text not null,
  name text not null,
  kind text not null,
  ownership text not null,
  include_in_net_worth boolean not null,
  opened_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint v2_accounts_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint v2_accounts_name_check check (
    name = btrim(name) and char_length(name) between 1 and 120
  ),
  constraint v2_accounts_kind_check check (
    kind in (
      'cash', 'bank', 'savings', 'broker', 'exchange', 'crypto-wallet', 'cold-wallet',
      'investment', 'liability', 'income', 'expense', 'external', 'equity'
    )
  ),
  constraint v2_accounts_ownership_check check (ownership in ('owned', 'external', 'system')),
  constraint v2_accounts_net_worth_check check (ownership = 'owned' or not include_in_net_worth),
  constraint v2_accounts_external_check check ((kind = 'external') = (ownership = 'external')),
  constraint v2_accounts_system_check check (
    (kind in ('income', 'expense', 'equity')) = (ownership = 'system')
  ),
  constraint v2_accounts_lifecycle_check check (
    opened_at is null or archived_at is null or archived_at >= opened_at
  )
);

create table public.v2_assets (
  user_id uuid not null references public.v2_profiles(user_id) on delete cascade,
  id text not null,
  symbol text not null,
  name text not null,
  kind text not null,
  precision smallint not null,
  fiat_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint v2_assets_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint v2_assets_symbol_check check (symbol ~ '^[A-Z0-9][A-Z0-9.-]{0,15}$'),
  constraint v2_assets_name_check check (
    name = btrim(name) and char_length(name) between 1 and 120
  ),
  constraint v2_assets_kind_check check (
    kind in ('fiat', 'crypto', 'equity', 'etf', 'fund', 'commodity', 'other')
  ),
  constraint v2_assets_precision_check check (precision between 0 and 18),
  constraint v2_assets_fiat_currency_check check (
    (kind = 'fiat' and fiat_currency ~ '^[A-Z]{3}$' and fiat_currency = symbol)
    or (kind <> 'fiat' and fiat_currency is null)
  )
);

create table public.v2_transactions (
  user_id uuid not null references public.v2_profiles(user_id) on delete cascade,
  id text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null,
  description text not null,
  purpose text not null default 'standard',
  related_transaction_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint v2_transactions_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint v2_transactions_description_check check (
    description = btrim(description) and char_length(description) between 1 and 240
  ),
  constraint v2_transactions_purpose_check check (purpose in ('standard', 'reversal', 'replacement')),
  constraint v2_transactions_related_check check (
    (purpose = 'standard' and related_transaction_id is null)
    or (purpose <> 'standard' and related_transaction_id is not null)
  ),
  constraint v2_transactions_recorded_check check (recorded_at >= occurred_at),
  constraint v2_transactions_related_fk foreign key (user_id, related_transaction_id)
    references public.v2_transactions(user_id, id)
);

create table public.v2_transaction_legs (
  user_id uuid not null references public.v2_profiles(user_id) on delete cascade,
  id text not null,
  transaction_id text not null,
  account_id text not null,
  asset_id text not null,
  quantity numeric not null,
  memo text,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, transaction_id, account_id, asset_id),
  constraint v2_transaction_legs_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint v2_transaction_legs_quantity_check check (quantity <> 0 and scale(quantity) <= 18),
  constraint v2_transaction_legs_memo_check check (
    memo is null or (memo = btrim(memo) and char_length(memo) between 1 and 240)
  ),
  constraint v2_transaction_legs_transaction_fk foreign key (user_id, transaction_id)
    references public.v2_transactions(user_id, id),
  constraint v2_transaction_legs_account_fk foreign key (user_id, account_id)
    references public.v2_accounts(user_id, id),
  constraint v2_transaction_legs_asset_fk foreign key (user_id, asset_id)
    references public.v2_assets(user_id, id)
);

create table public.v2_price_quotes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.v2_profiles(user_id) on delete cascade,
  asset_id text not null,
  amount numeric not null,
  currency text not null,
  as_of timestamptz not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (user_id, asset_id, as_of),
  constraint v2_price_quotes_asset_fk foreign key (user_id, asset_id)
    references public.v2_assets(user_id, id),
  constraint v2_price_quotes_amount_check check (amount >= 0 and scale(amount) <= 18),
  constraint v2_price_quotes_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint v2_price_quotes_source_check check (
    source = btrim(source) and char_length(source) between 1 and 80
  )
);

create table public.v2_fx_rates (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.v2_profiles(user_id) on delete cascade,
  source_currency text not null,
  target_currency text not null,
  rate numeric not null,
  as_of timestamptz not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (user_id, source_currency, target_currency, as_of),
  constraint v2_fx_rates_source_currency_check check (source_currency ~ '^[A-Z]{3}$'),
  constraint v2_fx_rates_target_currency_check check (target_currency ~ '^[A-Z]{3}$'),
  constraint v2_fx_rates_pair_check check (source_currency <> target_currency),
  constraint v2_fx_rates_rate_check check (rate > 0 and scale(rate) <= 18),
  constraint v2_fx_rates_source_check check (
    source = btrim(source) and char_length(source) between 1 and 80
  )
);

create index v2_transactions_replay_idx
  on public.v2_transactions (user_id, occurred_at, recorded_at, id);
create unique index v2_transactions_one_reversal_idx
  on public.v2_transactions (user_id, related_transaction_id)
  where purpose = 'reversal';
create unique index v2_transactions_one_replacement_idx
  on public.v2_transactions (user_id, related_transaction_id)
  where purpose = 'replacement';
create index v2_transaction_legs_transaction_idx
  on public.v2_transaction_legs (user_id, transaction_id);
create index v2_price_quotes_latest_idx
  on public.v2_price_quotes (user_id, asset_id, as_of desc);
create index v2_fx_rates_latest_idx
  on public.v2_fx_rates (user_id, source_currency, target_currency, as_of desc);

create or replace function public.v2_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger v2_profiles_touch_updated_at
before update on public.v2_profiles
for each row execute function public.v2_touch_updated_at();

create trigger v2_accounts_touch_updated_at
before update on public.v2_accounts
for each row execute function public.v2_touch_updated_at();

create trigger v2_assets_touch_updated_at
before update on public.v2_assets
for each row execute function public.v2_touch_updated_at();

create or replace function public.v2_reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'v2 financial history is immutable';
end;
$$;

create trigger v2_transactions_immutable
before update or delete on public.v2_transactions
for each row execute function public.v2_reject_immutable_mutation();

create trigger v2_transaction_legs_immutable
before update or delete on public.v2_transaction_legs
for each row execute function public.v2_reject_immutable_mutation();

create trigger v2_price_quotes_immutable
before update or delete on public.v2_price_quotes
for each row execute function public.v2_reject_immutable_mutation();

create trigger v2_fx_rates_immutable
before update or delete on public.v2_fx_rates
for each row execute function public.v2_reject_immutable_mutation();

create or replace function public.v2_handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.v2_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger v2_on_auth_user_created
after insert on auth.users
for each row execute function public.v2_handle_auth_user_created();

insert into public.v2_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

alter table public.v2_profiles enable row level security;
alter table public.v2_profiles force row level security;
alter table public.v2_accounts enable row level security;
alter table public.v2_accounts force row level security;
alter table public.v2_assets enable row level security;
alter table public.v2_assets force row level security;
alter table public.v2_transactions enable row level security;
alter table public.v2_transactions force row level security;
alter table public.v2_transaction_legs enable row level security;
alter table public.v2_transaction_legs force row level security;
alter table public.v2_price_quotes enable row level security;
alter table public.v2_price_quotes force row level security;
alter table public.v2_fx_rates enable row level security;
alter table public.v2_fx_rates force row level security;

create policy v2_profiles_select_own on public.v2_profiles
for select to authenticated using (user_id = auth.uid());
create policy v2_accounts_select_own on public.v2_accounts
for select to authenticated using (user_id = auth.uid());
create policy v2_assets_select_own on public.v2_assets
for select to authenticated using (user_id = auth.uid());
create policy v2_transactions_select_own on public.v2_transactions
for select to authenticated using (user_id = auth.uid());
create policy v2_transaction_legs_select_own on public.v2_transaction_legs
for select to authenticated using (user_id = auth.uid());
create policy v2_price_quotes_select_own on public.v2_price_quotes
for select to authenticated using (user_id = auth.uid());
create policy v2_fx_rates_select_own on public.v2_fx_rates
for select to authenticated using (user_id = auth.uid());

revoke all on public.v2_profiles from anon, authenticated;
revoke all on public.v2_accounts from anon, authenticated;
revoke all on public.v2_assets from anon, authenticated;
revoke all on public.v2_transactions from anon, authenticated;
revoke all on public.v2_transaction_legs from anon, authenticated;
revoke all on public.v2_price_quotes from anon, authenticated;
revoke all on public.v2_fx_rates from anon, authenticated;

grant select on public.v2_profiles to authenticated;
grant select on public.v2_accounts to authenticated;
grant select on public.v2_assets to authenticated;
grant select on public.v2_transactions to authenticated;
grant select on public.v2_transaction_legs to authenticated;
grant select on public.v2_price_quotes to authenticated;
grant select on public.v2_fx_rates to authenticated;

create or replace function public.v2_complete_onboarding(p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_display_name text := p_profile ->> 'displayName';
  v_base_currency text := p_profile ->> 'baseCurrency';
  v_locale text := p_profile ->> 'locale';
  v_result jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  insert into public.v2_profiles (user_id, display_name, base_currency, locale, onboarded)
  values (v_user, v_display_name, v_base_currency, v_locale, true)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        base_currency = excluded.base_currency,
        locale = excluded.locale,
        onboarded = true;

  select jsonb_build_object(
    'displayName', display_name,
    'baseCurrency', base_currency,
    'locale', locale,
    'onboarded', onboarded
  ) into v_result
  from public.v2_profiles
  where user_id = v_user;

  return v_result;
end;
$$;

create or replace function public.v2_put_account(p_account jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_account ->> 'id';
  v_name text := p_account ->> 'name';
  v_kind text := p_account ->> 'kind';
  v_ownership text := p_account ->> 'ownership';
  v_include boolean := (p_account ->> 'includeInNetWorth')::boolean;
  v_opened_text text := p_account ->> 'openedAt';
  v_archived_text text := p_account ->> 'archivedAt';
  v_opened timestamptz;
  v_archived timestamptz;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));
  if v_opened_text is not null and v_opened_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'openedAt must be an explicit ISO-8601 instant';
  end if;
  if v_archived_text is not null and v_archived_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'archivedAt must be an explicit ISO-8601 instant';
  end if;
  v_opened := v_opened_text::timestamptz;
  v_archived := v_archived_text::timestamptz;

  if exists (
    select 1
    from public.v2_transaction_legs l
    join public.v2_transactions t
      on t.user_id = l.user_id and t.id = l.transaction_id
    where l.user_id = v_user
      and l.account_id = v_id
      and (
        (v_opened is not null and t.occurred_at < v_opened)
        or (v_archived is not null and t.occurred_at > v_archived)
      )
  ) then
    raise exception 'account lifecycle would exclude existing transaction history';
  end if;

  insert into public.v2_accounts (
    user_id, id, name, kind, ownership, include_in_net_worth, opened_at, archived_at
  ) values (
    v_user, v_id, v_name, v_kind, v_ownership, v_include, v_opened, v_archived
  )
  on conflict (user_id, id) do update
    set name = excluded.name,
        kind = excluded.kind,
        ownership = excluded.ownership,
        include_in_net_worth = excluded.include_in_net_worth,
        opened_at = excluded.opened_at,
        archived_at = excluded.archived_at;
end;
$$;

create or replace function public.v2_put_asset(p_asset jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_asset ->> 'id';
  v_symbol text := upper(p_asset ->> 'symbol');
  v_name text := p_asset ->> 'name';
  v_kind text := p_asset ->> 'kind';
  v_precision smallint := (p_asset ->> 'precision')::smallint;
  v_fiat_currency text := p_asset ->> 'fiatCurrency';
  v_old_kind text;
  v_old_fiat text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  if exists (
    select 1
    from public.v2_transaction_legs
    where user_id = v_user and asset_id = v_id and scale(quantity) > v_precision
  ) then
    raise exception 'asset precision would invalidate existing transaction quantities';
  end if;

  select kind, fiat_currency into v_old_kind, v_old_fiat
  from public.v2_assets
  where user_id = v_user and id = v_id;

  if found
     and (v_old_kind is distinct from v_kind or v_old_fiat is distinct from v_fiat_currency)
     and exists (
       select 1 from public.v2_transaction_legs where user_id = v_user and asset_id = v_id
     ) then
    raise exception 'asset kind or fiat identity cannot change after ledger activity';
  end if;

  if v_kind = 'fiat' and exists (
    select 1 from public.v2_price_quotes where user_id = v_user and asset_id = v_id
  ) then
    raise exception 'fiat assets cannot have price quote history';
  end if;

  insert into public.v2_assets (
    user_id, id, symbol, name, kind, precision, fiat_currency
  ) values (
    v_user, v_id, v_symbol, v_name, v_kind, v_precision, v_fiat_currency
  )
  on conflict (user_id, id) do update
    set symbol = excluded.symbol,
        name = excluded.name,
        kind = excluded.kind,
        precision = excluded.precision,
        fiat_currency = excluded.fiat_currency;
end;
$$;

create or replace function public.v2_post_transaction(p_transaction jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_transaction ->> 'id';
  v_occurred_text text := p_transaction ->> 'occurredAt';
  v_recorded_text text := p_transaction ->> 'recordedAt';
  v_occurred timestamptz;
  v_recorded timestamptz;
  v_description text := p_transaction ->> 'description';
  v_purpose text := coalesce(p_transaction ->> 'purpose', 'standard');
  v_related text := p_transaction ->> 'relatedTransactionId';
  v_legs jsonb := p_transaction -> 'legs';
  v_target public.v2_transactions%rowtype;
  v_reversal_recorded timestamptz;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));
  if v_occurred_text is null or v_occurred_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'occurredAt must be an explicit ISO-8601 instant';
  end if;
  if v_recorded_text is null or v_recorded_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'recordedAt must be an explicit ISO-8601 instant';
  end if;
  v_occurred := v_occurred_text::timestamptz;
  v_recorded := v_recorded_text::timestamptz;
  if v_id is null or v_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'invalid transaction id';
  end if;
  if v_description is null or v_description <> btrim(v_description)
     or char_length(v_description) not between 1 and 240 then
    raise exception 'invalid transaction description';
  end if;
  if v_recorded < v_occurred then raise exception 'recordedAt cannot precede occurredAt'; end if;
  if v_purpose not in ('standard', 'reversal', 'replacement') then
    raise exception 'invalid transaction purpose';
  end if;
  if (v_purpose = 'standard' and v_related is not null)
     or (v_purpose <> 'standard' and v_related is null) then
    raise exception 'invalid related transaction relationship';
  end if;
  if jsonb_typeof(v_legs) <> 'array' or jsonb_array_length(v_legs) < 2 then
    raise exception 'transactions require at least two legs';
  end if;
  if exists (select 1 from public.v2_transactions where user_id = v_user and id = v_id) then
    raise exception 'duplicate transaction id';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_legs) as l(
      id text, "accountId" text, "assetId" text, quantity text, memo text
    )
    where id is null or id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
       or "accountId" is null or "accountId" !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
       or "assetId" is null or "assetId" !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
       or quantity is null or quantity !~ '^[+-]?[0-9]+(\.[0-9]+)?$'
       or (memo is not null and (memo <> btrim(memo) or char_length(memo) not between 1 and 240))
  ) then
    raise exception 'invalid transaction leg structure';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_legs) as l(quantity text)
    where (quantity::numeric) = 0 or scale(quantity::numeric) > 18
  ) then
    raise exception 'invalid transaction leg quantity';
  end if;

  if (
    select count(*) <> count(distinct id)
    from jsonb_to_recordset(v_legs) as l(id text)
  ) then
    raise exception 'duplicate transaction leg id';
  end if;

  if (
    select count(*) <> count(distinct ("accountId", "assetId"))
    from jsonb_to_recordset(v_legs) as l("accountId" text, "assetId" text)
  ) then
    raise exception 'duplicate account and asset pair inside transaction';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_legs) as l("accountId" text)
    left join public.v2_accounts a
      on a.user_id = v_user and a.id = l."accountId"
    where a.id is null
  ) then
    raise exception 'transaction references unknown account';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_legs) as l("assetId" text, quantity text)
    left join public.v2_assets a
      on a.user_id = v_user and a.id = l."assetId"
    where a.id is null or scale(l.quantity::numeric) > a.precision
  ) then
    raise exception 'transaction references unknown asset or exceeds asset precision';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_legs) as l("accountId" text)
    join public.v2_accounts a
      on a.user_id = v_user and a.id = l."accountId"
    where (a.opened_at is not null and v_occurred < a.opened_at)
       or (a.archived_at is not null and v_occurred > a.archived_at)
  ) then
    raise exception 'transaction violates account lifecycle';
  end if;

  if exists (
    select "assetId"
    from jsonb_to_recordset(v_legs) as l("assetId" text, quantity text)
    group by "assetId"
    having sum(quantity::numeric) <> 0
  ) then
    raise exception 'transaction legs are not balanced by asset';
  end if;

  if v_purpose <> 'standard' then
    select * into v_target
    from public.v2_transactions
    where user_id = v_user and id = v_related;

    if not found then raise exception 'correction references unknown transaction'; end if;
    if v_target.purpose <> 'standard' then
      raise exception 'corrections may target only standard transactions';
    end if;
    if v_recorded <= v_target.recorded_at then
      raise exception 'correction must be recorded after its target';
    end if;

    if v_purpose = 'reversal' then
      if v_occurred <> v_target.occurred_at then
        raise exception 'reversal must preserve target economic timestamp';
      end if;
      if exists (
        select 1 from public.v2_transactions
        where user_id = v_user and purpose = 'reversal' and related_transaction_id = v_related
      ) then
        raise exception 'target already has a reversal';
      end if;
      if (select count(*) from public.v2_transaction_legs
          where user_id = v_user and transaction_id = v_related) <> jsonb_array_length(v_legs) then
        raise exception 'reversal leg count does not match target';
      end if;
      if exists (
        select 1
        from jsonb_to_recordset(v_legs) as l("accountId" text, "assetId" text, quantity text)
        left join public.v2_transaction_legs original
          on original.user_id = v_user
         and original.transaction_id = v_related
         and original.account_id = l."accountId"
         and original.asset_id = l."assetId"
        where original.id is null or l.quantity::numeric <> -original.quantity
      ) then
        raise exception 'reversal is not the exact inverse of target';
      end if;
    else
      if exists (
        select 1 from public.v2_transactions
        where user_id = v_user and purpose = 'replacement' and related_transaction_id = v_related
      ) then
        raise exception 'target already has a replacement';
      end if;
      select recorded_at into v_reversal_recorded
      from public.v2_transactions
      where user_id = v_user and purpose = 'reversal' and related_transaction_id = v_related;
      if v_reversal_recorded is null then
        raise exception 'replacement requires an existing reversal';
      end if;
      if v_recorded <= v_reversal_recorded then
        raise exception 'replacement must be recorded after reversal';
      end if;
    end if;
  end if;

  insert into public.v2_transactions (
    user_id, id, occurred_at, recorded_at, description, purpose, related_transaction_id
  ) values (
    v_user, v_id, v_occurred, v_recorded, v_description, v_purpose, v_related
  );

  insert into public.v2_transaction_legs (
    user_id, id, transaction_id, account_id, asset_id, quantity, memo
  )
  select
    v_user,
    l.id,
    v_id,
    l."accountId",
    l."assetId",
    l.quantity::numeric,
    l.memo
  from jsonb_to_recordset(v_legs) as l(
    id text, "accountId" text, "assetId" text, quantity text, memo text
  );

  return v_id;
end;
$$;

create or replace function public.v2_append_price_quote(p_quote jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_asset text := p_quote ->> 'assetId';
  v_amount_text text := p_quote ->> 'amount';
  v_currency text := p_quote ->> 'currency';
  v_as_of_text text := p_quote ->> 'asOf';
  v_as_of timestamptz;
  v_amount numeric;
  v_kind text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));
  if v_as_of_text is null or v_as_of_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'asOf must be an explicit ISO-8601 instant';
  end if;
  v_as_of := v_as_of_text::timestamptz;
  if v_amount_text is null or v_amount_text !~ '^[+-]?[0-9]+(\.[0-9]+)?$' then
    raise exception 'invalid price amount';
  end if;
  v_amount := v_amount_text::numeric;
  if v_amount < 0 or scale(v_amount) > 18 then raise exception 'invalid price amount'; end if;

  select kind into v_kind from public.v2_assets where user_id = v_user and id = v_asset;
  if not found then raise exception 'price quote references unknown asset'; end if;
  if v_kind = 'fiat' then raise exception 'fiat assets cannot receive price quotes'; end if;

  insert into public.v2_price_quotes (user_id, asset_id, amount, currency, as_of)
  values (v_user, v_asset, v_amount, v_currency, v_as_of);
end;
$$;

create or replace function public.v2_append_fx_rate(p_rate jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_source text := p_rate ->> 'sourceCurrency';
  v_target text := p_rate ->> 'targetCurrency';
  v_rate_text text := p_rate ->> 'rate';
  v_as_of_text text := p_rate ->> 'asOf';
  v_as_of timestamptz;
  v_rate numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));
  if v_as_of_text is null or v_as_of_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'asOf must be an explicit ISO-8601 instant';
  end if;
  v_as_of := v_as_of_text::timestamptz;
  if v_rate_text is null or v_rate_text !~ '^[+-]?[0-9]+(\.[0-9]+)?$' then
    raise exception 'invalid FX rate';
  end if;
  v_rate := v_rate_text::numeric;
  if v_rate <= 0 or scale(v_rate) > 18 then raise exception 'invalid FX rate'; end if;

  insert into public.v2_fx_rates (user_id, source_currency, target_currency, rate, as_of)
  values (v_user, v_source, v_target, v_rate, v_as_of);
end;
$$;

create or replace function public.v2_get_financial_state()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
select jsonb_build_object(
  'profile', (
    select jsonb_build_object(
      'displayName', p.display_name,
      'baseCurrency', p.base_currency,
      'locale', p.locale,
      'onboarded', p.onboarded
    )
    from public.v2_profiles p
    where p.user_id = auth.uid()
  ),
  'accounts', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'name', a.name,
      'kind', a.kind,
      'ownership', a.ownership,
      'includeInNetWorth', a.include_in_net_worth,
      'openedAt', a.opened_at,
      'archivedAt', a.archived_at
    ) order by a.id)
    from public.v2_accounts a
    where a.user_id = auth.uid()
  ), '[]'::jsonb),
  'assets', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'symbol', a.symbol,
      'name', a.name,
      'kind', a.kind,
      'precision', a.precision,
      'fiatCurrency', a.fiat_currency
    ) order by a.id)
    from public.v2_assets a
    where a.user_id = auth.uid()
  ), '[]'::jsonb),
  'transactions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'occurredAt', t.occurred_at,
      'recordedAt', t.recorded_at,
      'description', t.description,
      'purpose', t.purpose,
      'relatedTransactionId', t.related_transaction_id,
      'legs', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id,
          'accountId', l.account_id,
          'assetId', l.asset_id,
          'quantity', l.quantity::text,
          'memo', l.memo
        ) order by l.id)
        from public.v2_transaction_legs l
        where l.user_id = t.user_id and l.transaction_id = t.id
      ), '[]'::jsonb)
    ) order by t.occurred_at, t.recorded_at, t.id)
    from public.v2_transactions t
    where t.user_id = auth.uid()
  ), '[]'::jsonb),
  'priceQuotes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'assetId', q.asset_id,
      'amount', q.amount::text,
      'currency', q.currency,
      'asOf', q.as_of
    ) order by q.asset_id, q.as_of)
    from public.v2_price_quotes q
    where q.user_id = auth.uid()
  ), '[]'::jsonb),
  'fxRates', coalesce((
    select jsonb_agg(jsonb_build_object(
      'sourceCurrency', r.source_currency,
      'targetCurrency', r.target_currency,
      'rate', r.rate::text,
      'asOf', r.as_of
    ) order by r.source_currency, r.target_currency, r.as_of)
    from public.v2_fx_rates r
    where r.user_id = auth.uid()
  ), '[]'::jsonb)
);
$$;

revoke all on function public.v2_complete_onboarding(jsonb) from public, anon, authenticated;
revoke all on function public.v2_put_account(jsonb) from public, anon, authenticated;
revoke all on function public.v2_put_asset(jsonb) from public, anon, authenticated;
revoke all on function public.v2_post_transaction(jsonb) from public, anon, authenticated;
revoke all on function public.v2_append_price_quote(jsonb) from public, anon, authenticated;
revoke all on function public.v2_append_fx_rate(jsonb) from public, anon, authenticated;
revoke all on function public.v2_get_financial_state() from public, anon, authenticated;

grant execute on function public.v2_complete_onboarding(jsonb) to authenticated;
grant execute on function public.v2_put_account(jsonb) to authenticated;
grant execute on function public.v2_put_asset(jsonb) to authenticated;
grant execute on function public.v2_post_transaction(jsonb) to authenticated;
grant execute on function public.v2_append_price_quote(jsonb) to authenticated;
grant execute on function public.v2_append_fx_rate(jsonb) to authenticated;
grant execute on function public.v2_get_financial_state() to authenticated;