-- Nebula Wealth Hub Phase 4: advanced workflows on the canonical v2 boundary.
-- Additive only. Legacy tables remain frozen historical evidence.

create table public.v2_goals (
  user_id uuid not null references public.v2_profiles(user_id) on delete cascade,
  id text not null,
  name text not null,
  kind text not null,
  target_amount numeric,
  target_quantity numeric,
  target_account_id text,
  target_asset_id text,
  target_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint v2_goals_id_check check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint v2_goals_name_check check (
    name = btrim(name) and char_length(name) between 1 and 120
  ),
  constraint v2_goals_kind_check check (
    kind in ('net_worth', 'liquid', 'account_balance', 'asset_quantity', 'asset_value')
  ),
  constraint v2_goals_target_amount_check check (
    target_amount is null or (target_amount > 0 and scale(target_amount) <= 18)
  ),
  constraint v2_goals_target_quantity_check check (
    target_quantity is null or (target_quantity > 0 and scale(target_quantity) <= 18)
  ),
  constraint v2_goals_shape_check check (
    (kind in ('net_worth', 'liquid')
      and target_amount is not null
      and target_quantity is null
      and target_account_id is null
      and target_asset_id is null)
    or
    (kind = 'account_balance'
      and target_amount is not null
      and target_quantity is null
      and target_account_id is not null
      and target_asset_id is null)
    or
    (kind = 'asset_quantity'
      and target_amount is null
      and target_quantity is not null
      and target_account_id is null
      and target_asset_id is not null)
    or
    (kind = 'asset_value'
      and target_amount is not null
      and target_quantity is null
      and target_account_id is null
      and target_asset_id is not null)
  ),
  constraint v2_goals_account_fk foreign key (user_id, target_account_id)
    references public.v2_accounts(user_id, id),
  constraint v2_goals_asset_fk foreign key (user_id, target_asset_id)
    references public.v2_assets(user_id, id)
);

create table public.v2_trading_settings (
  user_id uuid primary key references public.v2_profiles(user_id) on delete cascade,
  reserve numeric not null default 0,
  default_risk_pct numeric not null default 1,
  weekly_loss_limit_pct numeric not null default 5,
  max_daily_loss_pct numeric not null default 2,
  primary_asset text,
  updated_at timestamptz not null default now(),
  constraint v2_trading_settings_reserve_check check (
    reserve >= 0 and scale(reserve) <= 18
  ),
  constraint v2_trading_settings_default_risk_check check (
    default_risk_pct between 0 and 100 and scale(default_risk_pct) <= 6
  ),
  constraint v2_trading_settings_weekly_loss_check check (
    weekly_loss_limit_pct between 0 and 100 and scale(weekly_loss_limit_pct) <= 6
  ),
  constraint v2_trading_settings_daily_loss_check check (
    max_daily_loss_pct between 0 and 100 and scale(max_daily_loss_pct) <= 6
  ),
  constraint v2_trading_settings_primary_asset_check check (
    primary_asset is null
    or (primary_asset = btrim(primary_asset) and char_length(primary_asset) between 1 and 32)
  )
);

create table public.v2_weekly_reviews (
  user_id uuid not null references public.v2_profiles(user_id) on delete cascade,
  id text not null,
  week_start date not null,
  reported_pnl numeric not null default 0,
  win_rate numeric not null default 0,
  avg_rr numeric not null default 0,
  trade_count integer not null default 0,
  max_drawdown_pct numeric not null default 0,
  discipline_score smallint not null default 70,
  psychology_score smallint not null default 70,
  consistency_score smallint not null default 70,
  notes text,
  lessons text,
  is_draft boolean not null default true,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, week_start),
  constraint v2_weekly_reviews_id_check check (
    id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  ),
  constraint v2_weekly_reviews_week_monday_check check (
    extract(isodow from week_start) = 1
  ),
  constraint v2_weekly_reviews_pnl_check check (scale(reported_pnl) <= 18),
  constraint v2_weekly_reviews_win_rate_check check (
    win_rate between 0 and 100 and scale(win_rate) <= 6
  ),
  constraint v2_weekly_reviews_avg_rr_check check (
    avg_rr >= 0 and scale(avg_rr) <= 18
  ),
  constraint v2_weekly_reviews_trade_count_check check (
    trade_count between 0 and 1000000
  ),
  constraint v2_weekly_reviews_drawdown_check check (
    max_drawdown_pct between 0 and 100 and scale(max_drawdown_pct) <= 6
  ),
  constraint v2_weekly_reviews_discipline_check check (
    discipline_score between 0 and 100
  ),
  constraint v2_weekly_reviews_psychology_check check (
    psychology_score between 0 and 100
  ),
  constraint v2_weekly_reviews_consistency_check check (
    consistency_score between 0 and 100
  ),
  constraint v2_weekly_reviews_notes_check check (
    notes is null or (notes = btrim(notes) and char_length(notes) between 1 and 4000)
  ),
  constraint v2_weekly_reviews_lessons_check check (
    lessons is null or (lessons = btrim(lessons) and char_length(lessons) between 1 and 4000)
  ),
  constraint v2_weekly_reviews_finalized_check check (
    finalized_at is null or not is_draft
  )
);

create table public.v2_import_batches (
  user_id uuid not null references public.v2_profiles(user_id) on delete cascade,
  id text not null,
  label text,
  source_text text not null,
  transaction_count integer not null,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  primary key (user_id, id),
  constraint v2_import_batches_id_check check (
    id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  ),
  constraint v2_import_batches_label_check check (
    label is null or (label = btrim(label) and char_length(label) between 1 and 120)
  ),
  constraint v2_import_batches_source_check check (
    char_length(source_text) between 1 and 2000000
  ),
  constraint v2_import_batches_count_check check (
    transaction_count between 1 and 5000
  )
);

create table public.v2_import_batch_transactions (
  user_id uuid not null,
  batch_id text not null,
  transaction_id text not null,
  ordinal integer not null,
  primary key (user_id, batch_id, transaction_id),
  unique (user_id, batch_id, ordinal),
  constraint v2_import_batch_transactions_ordinal_check check (ordinal >= 0),
  constraint v2_import_batch_transactions_batch_fk foreign key (user_id, batch_id)
    references public.v2_import_batches(user_id, id) on delete cascade,
  constraint v2_import_batch_transactions_transaction_fk foreign key (user_id, transaction_id)
    references public.v2_transactions(user_id, id)
);

create trigger v2_goals_touch_updated_at
before update on public.v2_goals
for each row execute function public.v2_touch_updated_at();

create trigger v2_weekly_reviews_touch_updated_at
before update on public.v2_weekly_reviews
for each row execute function public.v2_touch_updated_at();

create trigger v2_trading_settings_touch_updated_at
before update on public.v2_trading_settings
for each row execute function public.v2_touch_updated_at();

create or replace function public.v2_reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_setting('nebula.v2_maintenance', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'v2 financial history is immutable';
end;
$$;

create or replace function public.v2_guard_weekly_review_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_setting('nebula.v2_maintenance', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if old.finalized_at is not null then
    raise exception 'finalized weekly reviews are immutable';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger v2_weekly_reviews_guard
before update or delete on public.v2_weekly_reviews
for each row execute function public.v2_guard_weekly_review_mutation();

alter table public.v2_goals enable row level security;
alter table public.v2_goals force row level security;
alter table public.v2_trading_settings enable row level security;
alter table public.v2_trading_settings force row level security;
alter table public.v2_weekly_reviews enable row level security;
alter table public.v2_weekly_reviews force row level security;
alter table public.v2_import_batches enable row level security;
alter table public.v2_import_batches force row level security;
alter table public.v2_import_batch_transactions enable row level security;
alter table public.v2_import_batch_transactions force row level security;

create policy v2_goals_select_own on public.v2_goals
for select to authenticated using (user_id = auth.uid());
create policy v2_trading_settings_select_own on public.v2_trading_settings
for select to authenticated using (user_id = auth.uid());
create policy v2_weekly_reviews_select_own on public.v2_weekly_reviews
for select to authenticated using (user_id = auth.uid());
create policy v2_import_batches_select_own on public.v2_import_batches
for select to authenticated using (user_id = auth.uid());
create policy v2_import_batch_transactions_select_own on public.v2_import_batch_transactions
for select to authenticated using (user_id = auth.uid());

revoke all on public.v2_goals from anon, authenticated;
revoke all on public.v2_trading_settings from anon, authenticated;
revoke all on public.v2_weekly_reviews from anon, authenticated;
revoke all on public.v2_import_batches from anon, authenticated;
revoke all on public.v2_import_batch_transactions from anon, authenticated;

grant select on public.v2_goals to authenticated;
grant select on public.v2_trading_settings to authenticated;
grant select on public.v2_weekly_reviews to authenticated;
grant select on public.v2_import_batches to authenticated;
grant select on public.v2_import_batch_transactions to authenticated;

create or replace function public.v2_get_advanced_state()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
select jsonb_build_object(
  'goals', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'kind', g.kind,
      'targetAmount', case when g.target_amount is null then null else g.target_amount::text end,
      'targetQuantity', case when g.target_quantity is null then null else g.target_quantity::text end,
      'targetAccountId', g.target_account_id,
      'targetAssetId', g.target_asset_id,
      'targetDate', case when g.target_date is null then null else g.target_date::text end,
      'archivedAt', g.archived_at
    ) order by g.created_at, g.id)
    from public.v2_goals g
    where g.user_id = auth.uid()
  ), '[]'::jsonb),
  'tradingSettings', (
    select jsonb_build_object(
      'reserve', s.reserve::text,
      'defaultRiskPct', s.default_risk_pct::text,
      'weeklyLossLimitPct', s.weekly_loss_limit_pct::text,
      'maxDailyLossPct', s.max_daily_loss_pct::text,
      'primaryAsset', s.primary_asset
    )
    from public.v2_trading_settings s
    where s.user_id = auth.uid()
  ),
  'weeklyReviews', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id,
      'weekStart', w.week_start::text,
      'reportedPnl', w.reported_pnl::text,
      'winRate', w.win_rate::text,
      'avgRr', w.avg_rr::text,
      'tradeCount', w.trade_count,
      'maxDrawdownPct', w.max_drawdown_pct::text,
      'disciplineScore', w.discipline_score,
      'psychologyScore', w.psychology_score,
      'consistencyScore', w.consistency_score,
      'notes', w.notes,
      'lessons', w.lessons,
      'isDraft', w.is_draft,
      'finalizedAt', w.finalized_at
    ) order by w.week_start desc, w.id)
    from public.v2_weekly_reviews w
    where w.user_id = auth.uid()
  ), '[]'::jsonb),
  'importBatches', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id,
      'label', b.label,
      'createdAt', b.created_at,
      'transactionCount', b.transaction_count,
      'rolledBackAt', b.rolled_back_at,
      'transactionIds', coalesce((
        select jsonb_agg(bt.transaction_id order by bt.ordinal)
        from public.v2_import_batch_transactions bt
        where bt.user_id = b.user_id and bt.batch_id = b.id
      ), '[]'::jsonb)
    ) order by b.created_at desc, b.id)
    from public.v2_import_batches b
    where b.user_id = auth.uid()
  ), '[]'::jsonb)
);
$$;

create or replace function public.v2_put_goal(p_goal jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_goal ->> 'id';
  v_name text := p_goal ->> 'name';
  v_kind text := p_goal ->> 'kind';
  v_target_amount_text text := p_goal ->> 'targetAmount';
  v_target_quantity_text text := p_goal ->> 'targetQuantity';
  v_target_account text := p_goal ->> 'targetAccountId';
  v_target_asset text := p_goal ->> 'targetAssetId';
  v_target_date_text text := p_goal ->> 'targetDate';
  v_target_amount numeric;
  v_target_quantity numeric;
  v_target_date date;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  if v_id is null or v_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'invalid goal id';
  end if;
  if v_name is null or v_name <> btrim(v_name) or char_length(v_name) not between 1 and 120 then
    raise exception 'invalid goal name';
  end if;
  if v_kind not in ('net_worth', 'liquid', 'account_balance', 'asset_quantity', 'asset_value') then
    raise exception 'invalid goal kind';
  end if;

  if v_target_amount_text is not null then
    if v_target_amount_text !~ '^[+]?[0-9]+(\.[0-9]+)?$' then
      raise exception 'invalid goal target amount';
    end if;
    v_target_amount := v_target_amount_text::numeric;
    if v_target_amount <= 0 or scale(v_target_amount) > 18 then
      raise exception 'invalid goal target amount';
    end if;
  end if;

  if v_target_quantity_text is not null then
    if v_target_quantity_text !~ '^[+]?[0-9]+(\.[0-9]+)?$' then
      raise exception 'invalid goal target quantity';
    end if;
    v_target_quantity := v_target_quantity_text::numeric;
    if v_target_quantity <= 0 or scale(v_target_quantity) > 18 then
      raise exception 'invalid goal target quantity';
    end if;
  end if;

  if v_target_date_text is not null then
    if v_target_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'invalid goal target date';
    end if;
    v_target_date := v_target_date_text::date;
  end if;

  if v_kind in ('net_worth', 'liquid') and (
    v_target_amount is null or v_target_quantity is not null
    or v_target_account is not null or v_target_asset is not null
  ) then
    raise exception 'invalid goal target shape';
  elsif v_kind = 'account_balance' then
    if v_target_amount is null or v_target_quantity is not null
       or v_target_account is null or v_target_asset is not null then
      raise exception 'invalid goal target shape';
    end if;
    if not exists (
      select 1 from public.v2_accounts
      where user_id = v_user and id = v_target_account and ownership = 'owned'
    ) then
      raise exception 'goal references unknown or non-owned account';
    end if;
  elsif v_kind = 'asset_quantity' then
    if v_target_amount is not null or v_target_quantity is null
       or v_target_account is not null or v_target_asset is null then
      raise exception 'invalid goal target shape';
    end if;
    if not exists (
      select 1
      from public.v2_assets
      where user_id = v_user
        and id = v_target_asset
        and scale(v_target_quantity) <= precision
    ) then
      if exists (
        select 1 from public.v2_assets where user_id = v_user and id = v_target_asset
      ) then
        raise exception 'goal target quantity exceeds asset precision';
      end if;
      raise exception 'goal references unknown asset';
    end if;
  elsif v_kind = 'asset_value' then
    if v_target_amount is null or v_target_quantity is not null
       or v_target_account is not null or v_target_asset is null then
      raise exception 'invalid goal target shape';
    end if;
    if not exists (
      select 1 from public.v2_assets where user_id = v_user and id = v_target_asset
    ) then
      raise exception 'goal references unknown asset';
    end if;
  end if;

  insert into public.v2_goals (
    user_id, id, name, kind, target_amount, target_quantity,
    target_account_id, target_asset_id, target_date
  ) values (
    v_user, v_id, v_name, v_kind, v_target_amount, v_target_quantity,
    v_target_account, v_target_asset, v_target_date
  )
  on conflict (user_id, id) do update
    set name = excluded.name,
        kind = excluded.kind,
        target_amount = excluded.target_amount,
        target_quantity = excluded.target_quantity,
        target_account_id = excluded.target_account_id,
        target_asset_id = excluded.target_asset_id,
        target_date = excluded.target_date;
end;
$$;

create or replace function public.v2_archive_goal(p_goal_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  update public.v2_goals
  set archived_at = coalesce(archived_at, clock_timestamp())
  where user_id = v_user and id = p_goal_id;

  if not found then raise exception 'goal not found'; end if;
end;
$$;

create or replace function public.v2_put_trading_settings(p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_reserve_text text := p_settings ->> 'reserve';
  v_default_risk_text text := p_settings ->> 'defaultRiskPct';
  v_weekly_loss_text text := p_settings ->> 'weeklyLossLimitPct';
  v_daily_loss_text text := p_settings ->> 'maxDailyLossPct';
  v_primary_asset text := p_settings ->> 'primaryAsset';
  v_reserve numeric;
  v_default_risk numeric;
  v_weekly_loss numeric;
  v_daily_loss numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  if v_reserve_text is null or v_reserve_text !~ '^[+]?[0-9]+(\.[0-9]+)?$'
     or v_default_risk_text is null or v_default_risk_text !~ '^[+]?[0-9]+(\.[0-9]+)?$'
     or v_weekly_loss_text is null or v_weekly_loss_text !~ '^[+]?[0-9]+(\.[0-9]+)?$'
     or v_daily_loss_text is null or v_daily_loss_text !~ '^[+]?[0-9]+(\.[0-9]+)?$' then
    raise exception 'invalid trading settings numeric value';
  end if;

  v_reserve := v_reserve_text::numeric;
  v_default_risk := v_default_risk_text::numeric;
  v_weekly_loss := v_weekly_loss_text::numeric;
  v_daily_loss := v_daily_loss_text::numeric;

  if v_reserve < 0 or scale(v_reserve) > 18
     or v_default_risk not between 0 and 100 or scale(v_default_risk) > 6
     or v_weekly_loss not between 0 and 100 or scale(v_weekly_loss) > 6
     or v_daily_loss not between 0 and 100 or scale(v_daily_loss) > 6 then
    raise exception 'invalid trading settings range';
  end if;

  if v_primary_asset is not null and (
    v_primary_asset <> btrim(v_primary_asset) or char_length(v_primary_asset) not between 1 and 32
  ) then
    raise exception 'invalid primary asset';
  end if;

  insert into public.v2_trading_settings (
    user_id, reserve, default_risk_pct, weekly_loss_limit_pct,
    max_daily_loss_pct, primary_asset
  ) values (
    v_user, v_reserve, v_default_risk, v_weekly_loss, v_daily_loss, v_primary_asset
  )
  on conflict (user_id) do update
    set reserve = excluded.reserve,
        default_risk_pct = excluded.default_risk_pct,
        weekly_loss_limit_pct = excluded.weekly_loss_limit_pct,
        max_daily_loss_pct = excluded.max_daily_loss_pct,
        primary_asset = excluded.primary_asset;
end;
$$;

create or replace function public.v2_put_weekly_review(p_review jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_review ->> 'id';
  v_week_start_text text := p_review ->> 'weekStart';
  v_pnl_text text := p_review ->> 'reportedPnl';
  v_win_rate_text text := p_review ->> 'winRate';
  v_avg_rr_text text := p_review ->> 'avgRr';
  v_trade_count integer := (p_review ->> 'tradeCount')::integer;
  v_drawdown_text text := p_review ->> 'maxDrawdownPct';
  v_discipline smallint := (p_review ->> 'disciplineScore')::smallint;
  v_psychology smallint := (p_review ->> 'psychologyScore')::smallint;
  v_notes text := p_review ->> 'notes';
  v_lessons text := p_review ->> 'lessons';
  v_week_start date;
  v_pnl numeric;
  v_win_rate numeric;
  v_avg_rr numeric;
  v_drawdown numeric;
  v_consistency smallint;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  if v_id is null or v_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'invalid weekly review id';
  end if;
  if v_week_start_text is null or v_week_start_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'invalid week start';
  end if;
  v_week_start := v_week_start_text::date;
  if extract(isodow from v_week_start) <> 1 then raise exception 'week start must be Monday'; end if;

  if v_pnl_text is null or v_pnl_text !~ '^[+-]?[0-9]+(\.[0-9]+)?$'
     or v_win_rate_text is null or v_win_rate_text !~ '^[+]?[0-9]+(\.[0-9]+)?$'
     or v_avg_rr_text is null or v_avg_rr_text !~ '^[+]?[0-9]+(\.[0-9]+)?$'
     or v_drawdown_text is null or v_drawdown_text !~ '^[+]?[0-9]+(\.[0-9]+)?$' then
    raise exception 'invalid weekly review numeric value';
  end if;

  v_pnl := v_pnl_text::numeric;
  v_win_rate := v_win_rate_text::numeric;
  v_avg_rr := v_avg_rr_text::numeric;
  v_drawdown := v_drawdown_text::numeric;

  if scale(v_pnl) > 18
     or v_win_rate not between 0 and 100 or scale(v_win_rate) > 6
     or v_avg_rr < 0 or scale(v_avg_rr) > 18
     or v_trade_count not between 0 and 1000000
     or v_drawdown not between 0 and 100 or scale(v_drawdown) > 6
     or v_discipline not between 0 and 100
     or v_psychology not between 0 and 100 then
    raise exception 'invalid weekly review range';
  end if;

  if v_notes is not null and (
    v_notes <> btrim(v_notes) or char_length(v_notes) not between 1 and 4000
  ) then
    raise exception 'invalid weekly review notes';
  end if;
  if v_lessons is not null and (
    v_lessons <> btrim(v_lessons) or char_length(v_lessons) not between 1 and 4000
  ) then
    raise exception 'invalid weekly review lessons';
  end if;

  v_consistency := least(
    100,
    greatest(
      0,
      round(
        ((v_discipline::numeric + v_psychology::numeric) / 2)
        + least(20::numeric, v_win_rate / 5)
        - (v_drawdown / 2)
      )::integer
    )
  )::smallint;

  if exists (
    select 1 from public.v2_weekly_reviews
    where user_id = v_user and id = v_id and finalized_at is not null
  ) then
    raise exception 'finalized weekly reviews are immutable';
  end if;

  insert into public.v2_weekly_reviews (
    user_id, id, week_start, reported_pnl, win_rate, avg_rr, trade_count,
    max_drawdown_pct, discipline_score, psychology_score, consistency_score,
    notes, lessons, is_draft, finalized_at
  ) values (
    v_user, v_id, v_week_start, v_pnl, v_win_rate, v_avg_rr, v_trade_count,
    v_drawdown, v_discipline, v_psychology, v_consistency,
    v_notes, v_lessons, true, null
  )
  on conflict (user_id, id) do update
    set week_start = excluded.week_start,
        reported_pnl = excluded.reported_pnl,
        win_rate = excluded.win_rate,
        avg_rr = excluded.avg_rr,
        trade_count = excluded.trade_count,
        max_drawdown_pct = excluded.max_drawdown_pct,
        discipline_score = excluded.discipline_score,
        psychology_score = excluded.psychology_score,
        consistency_score = excluded.consistency_score,
        notes = excluded.notes,
        lessons = excluded.lessons,
        is_draft = true,
        finalized_at = null;
end;
$$;

create or replace function public.v2_finalize_weekly_review(p_review_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  if exists (
    select 1 from public.v2_weekly_reviews
    where user_id = v_user and id = p_review_id and finalized_at is not null
  ) then
    return;
  end if;

  update public.v2_weekly_reviews
  set is_draft = false, finalized_at = clock_timestamp()
  where user_id = v_user and id = p_review_id;

  if not found then raise exception 'weekly review not found'; end if;
end;
$$;

create or replace function public.v2_delete_weekly_review(p_review_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  if exists (
    select 1 from public.v2_weekly_reviews
    where user_id = v_user and id = p_review_id and finalized_at is not null
  ) then
    raise exception 'finalized weekly reviews are immutable';
  end if;

  delete from public.v2_weekly_reviews
  where user_id = v_user and id = p_review_id;

  if not found then raise exception 'weekly review not found'; end if;
end;
$$;

create or replace function public.v2_import_batch(p_batch jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_batch_id text := p_batch ->> 'id';
  v_label text := p_batch ->> 'label';
  v_source_text text := p_batch ->> 'sourceText';
  v_transactions jsonb := p_batch -> 'transactions';
  v_transaction jsonb;
  v_ordinal integer := 0;
  v_transaction_id text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  if v_batch_id is null or v_batch_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'invalid import batch id';
  end if;
  if v_label is not null and (
    v_label <> btrim(v_label) or char_length(v_label) not between 1 and 120
  ) then
    raise exception 'invalid import batch label';
  end if;
  if v_source_text is null or char_length(v_source_text) not between 1 and 2000000 then
    raise exception 'invalid import source text';
  end if;
  if jsonb_typeof(v_transactions) <> 'array'
     or jsonb_array_length(v_transactions) not between 1 and 5000 then
    raise exception 'invalid import transaction batch';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_transactions) tx
    where coalesce(tx ->> 'purpose', 'standard') <> 'standard'
       or tx ->> 'relatedTransactionId' is not null
  ) then
    raise exception 'bulk import accepts only standard transactions';
  end if;

  insert into public.v2_import_batches (
    user_id, id, label, source_text, transaction_count
  ) values (
    v_user, v_batch_id, v_label, v_source_text, jsonb_array_length(v_transactions)
  );

  for v_transaction in select value from jsonb_array_elements(v_transactions)
  loop
    v_transaction_id := public.v2_post_transaction(v_transaction);
    insert into public.v2_import_batch_transactions (
      user_id, batch_id, transaction_id, ordinal
    ) values (
      v_user, v_batch_id, v_transaction_id, v_ordinal
    );
    v_ordinal := v_ordinal + 1;
  end loop;
end;
$$;

create or replace function public.v2_rollback_import_batch(p_batch_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_batch public.v2_import_batches%rowtype;
  v_row record;
  v_recorded timestamptz;
  v_reversal_id text;
  v_legs jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  select * into v_batch
  from public.v2_import_batches
  where user_id = v_user and id = p_batch_id
  for update;

  if not found then raise exception 'import batch not found'; end if;
  if v_batch.rolled_back_at is not null then raise exception 'import batch already rolled back'; end if;

  if exists (
    select 1
    from public.v2_import_batch_transactions bt
    join public.v2_transactions correction
      on correction.user_id = bt.user_id
     and correction.related_transaction_id = bt.transaction_id
     and correction.purpose in ('reversal', 'replacement')
    where bt.user_id = v_user and bt.batch_id = p_batch_id
  ) then
    raise exception 'import batch contains transactions that already have corrections';
  end if;

  for v_row in
    select bt.ordinal, t.*
    from public.v2_import_batch_transactions bt
    join public.v2_transactions t
      on t.user_id = bt.user_id and t.id = bt.transaction_id
    where bt.user_id = v_user and bt.batch_id = p_batch_id
    order by bt.ordinal desc
  loop
    v_recorded := greatest(clock_timestamp(), v_row.recorded_at + interval '1 millisecond');
    v_reversal_id := 'rollback:' || substr(md5(p_batch_id || ':' || v_row.id), 1, 32);

    select jsonb_agg(jsonb_build_object(
      'id', 'rollback-leg:' || substr(md5(p_batch_id || ':' || l.id), 1, 32),
      'accountId', l.account_id,
      'assetId', l.asset_id,
      'quantity', (-l.quantity)::text,
      'memo', l.memo
    ) order by l.id)
    into v_legs
    from public.v2_transaction_legs l
    where l.user_id = v_user and l.transaction_id = v_row.id;

    perform public.v2_post_transaction(jsonb_build_object(
      'id', v_reversal_id,
      'occurredAt', to_char(v_row.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'recordedAt', to_char(v_recorded at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'description', left('Rollback import: ' || v_row.description, 240),
      'purpose', 'reversal',
      'relatedTransactionId', v_row.id,
      'legs', v_legs
    ));
  end loop;

  update public.v2_import_batches
  set rolled_back_at = clock_timestamp()
  where user_id = v_user and id = p_batch_id;
end;
$$;

create or replace function public.v2_export_backup()
returns jsonb
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
select jsonb_build_object(
  'schemaVersion', 1,
  'exportedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
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
  'financialState', public.v2_get_financial_state(),
  'advancedState', jsonb_build_object(
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'kind', g.kind,
        'targetAmount', case when g.target_amount is null then null else g.target_amount::text end,
        'targetQuantity', case when g.target_quantity is null then null else g.target_quantity::text end,
        'targetAccountId', g.target_account_id,
        'targetAssetId', g.target_asset_id,
        'targetDate', case when g.target_date is null then null else g.target_date::text end,
        'archivedAt', g.archived_at,
        'createdAt', g.created_at,
        'updatedAt', g.updated_at
      ) order by g.created_at, g.id)
      from public.v2_goals g where g.user_id = auth.uid()
    ), '[]'::jsonb),
    'tradingSettings', (
      select jsonb_build_object(
        'reserve', s.reserve::text,
        'defaultRiskPct', s.default_risk_pct::text,
        'weeklyLossLimitPct', s.weekly_loss_limit_pct::text,
        'maxDailyLossPct', s.max_daily_loss_pct::text,
        'primaryAsset', s.primary_asset,
        'updatedAt', s.updated_at
      )
      from public.v2_trading_settings s where s.user_id = auth.uid()
    ),
    'weeklyReviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'weekStart', w.week_start::text,
        'reportedPnl', w.reported_pnl::text,
        'winRate', w.win_rate::text,
        'avgRr', w.avg_rr::text,
        'tradeCount', w.trade_count,
        'maxDrawdownPct', w.max_drawdown_pct::text,
        'disciplineScore', w.discipline_score,
        'psychologyScore', w.psychology_score,
        'consistencyScore', w.consistency_score,
        'notes', w.notes,
        'lessons', w.lessons,
        'isDraft', w.is_draft,
        'finalizedAt', w.finalized_at,
        'createdAt', w.created_at,
        'updatedAt', w.updated_at
      ) order by w.week_start, w.id)
      from public.v2_weekly_reviews w where w.user_id = auth.uid()
    ), '[]'::jsonb),
    'importBatches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'label', b.label,
        'sourceText', b.source_text,
        'transactionCount', b.transaction_count,
        'createdAt', b.created_at,
        'rolledBackAt', b.rolled_back_at,
        'transactionIds', coalesce((
          select jsonb_agg(bt.transaction_id order by bt.ordinal)
          from public.v2_import_batch_transactions bt
          where bt.user_id = b.user_id and bt.batch_id = b.id
        ), '[]'::jsonb)
      ) order by b.created_at, b.id)
      from public.v2_import_batches b where b.user_id = auth.uid()
    ), '[]'::jsonb)
  )
);
$$;

create or replace function public.v2_restore_backup(p_backup jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_financial jsonb := p_backup -> 'financialState';
  v_advanced jsonb := p_backup -> 'advancedState';
  v_profile jsonb := p_backup -> 'profile';
  v_row jsonb;
  v_batch jsonb;
  v_transaction_id jsonb;
  v_ordinal integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  if p_backup is null
     or not (p_backup ? 'schemaVersion')
     or not (p_backup ? 'exportedAt')
     or not (p_backup ? 'profile')
     or not (p_backup ? 'financialState')
     or not (p_backup ? 'advancedState')
     or p_backup ->> 'schemaVersion' <> '1'
     or jsonb_typeof(v_financial) <> 'object'
     or jsonb_typeof(v_advanced) <> 'object'
     or jsonb_typeof(v_profile) not in ('object', 'null') then
    raise exception 'invalid backup envelope';
  end if;

  if jsonb_typeof(v_financial -> 'accounts') <> 'array'
     or jsonb_typeof(v_financial -> 'assets') <> 'array'
     or jsonb_typeof(v_financial -> 'transactions') <> 'array'
     or jsonb_typeof(v_financial -> 'priceQuotes') <> 'array'
     or jsonb_typeof(v_financial -> 'fxRates') <> 'array'
     or jsonb_typeof(v_advanced -> 'goals') <> 'array'
     or jsonb_typeof(v_advanced -> 'weeklyReviews') <> 'array'
     or jsonb_typeof(v_advanced -> 'importBatches') <> 'array' then
    raise exception 'invalid backup dataset shape';
  end if;

  perform set_config('nebula.v2_maintenance', 'on', true);

  delete from public.v2_import_batch_transactions where user_id = v_user;
  delete from public.v2_import_batches where user_id = v_user;
  delete from public.v2_weekly_reviews where user_id = v_user;
  delete from public.v2_goals where user_id = v_user;
  delete from public.v2_trading_settings where user_id = v_user;
  delete from public.v2_transaction_legs where user_id = v_user;
  delete from public.v2_transactions where user_id = v_user;
  delete from public.v2_price_quotes where user_id = v_user;
  delete from public.v2_fx_rates where user_id = v_user;
  delete from public.v2_assets where user_id = v_user;
  delete from public.v2_accounts where user_id = v_user;

  if jsonb_typeof(v_profile) = 'object' then
    perform public.v2_complete_onboarding(v_profile);
  end if;

  for v_row in select value from jsonb_array_elements(v_financial -> 'accounts')
  loop
    perform public.v2_put_account(v_row);
  end loop;

  for v_row in select value from jsonb_array_elements(v_financial -> 'assets')
  loop
    perform public.v2_put_asset(v_row);
  end loop;

  for v_row in select value from jsonb_array_elements(v_financial -> 'transactions')
  loop
    perform public.v2_post_transaction(v_row);
  end loop;

  for v_row in select value from jsonb_array_elements(v_financial -> 'priceQuotes')
  loop
    perform public.v2_append_price_quote(v_row);
  end loop;

  for v_row in select value from jsonb_array_elements(v_financial -> 'fxRates')
  loop
    perform public.v2_append_fx_rate(v_row);
  end loop;

  for v_row in select value from jsonb_array_elements(v_advanced -> 'goals')
  loop
    perform public.v2_put_goal(v_row);
    if v_row ->> 'archivedAt' is not null then
      update public.v2_goals
      set archived_at = (v_row ->> 'archivedAt')::timestamptz
      where user_id = v_user and id = v_row ->> 'id';
    end if;
  end loop;

  if jsonb_typeof(v_advanced -> 'tradingSettings') = 'object' then
    perform public.v2_put_trading_settings(v_advanced -> 'tradingSettings');
  end if;

  for v_row in select value from jsonb_array_elements(v_advanced -> 'weeklyReviews')
  loop
    perform public.v2_put_weekly_review(v_row);
    if v_row ->> 'finalizedAt' is not null then
      update public.v2_weekly_reviews
      set is_draft = false,
          finalized_at = (v_row ->> 'finalizedAt')::timestamptz
      where user_id = v_user and id = v_row ->> 'id';
    end if;
  end loop;

  for v_batch in select value from jsonb_array_elements(v_advanced -> 'importBatches')
  loop
    if jsonb_typeof(v_batch -> 'transactionIds') <> 'array' then
      raise exception 'invalid backup import receipt';
    end if;
    if jsonb_array_length(v_batch -> 'transactionIds') <> (v_batch ->> 'transactionCount')::integer then
      raise exception 'backup import receipt count mismatch';
    end if;

    insert into public.v2_import_batches (
      user_id, id, label, source_text, transaction_count, created_at, rolled_back_at
    ) values (
      v_user,
      v_batch ->> 'id',
      v_batch ->> 'label',
      v_batch ->> 'sourceText',
      (v_batch ->> 'transactionCount')::integer,
      coalesce((v_batch ->> 'createdAt')::timestamptz, clock_timestamp()),
      (v_batch ->> 'rolledBackAt')::timestamptz
    );

    v_ordinal := 0;
    for v_transaction_id in select value from jsonb_array_elements(v_batch -> 'transactionIds')
    loop
      if not exists (
        select 1 from public.v2_transactions
        where user_id = v_user and id = trim(both '"' from v_transaction_id::text)
      ) then
        raise exception 'backup import receipt references unknown transaction';
      end if;

      insert into public.v2_import_batch_transactions (
        user_id, batch_id, transaction_id, ordinal
      ) values (
        v_user,
        v_batch ->> 'id',
        trim(both '"' from v_transaction_id::text),
        v_ordinal
      );
      v_ordinal := v_ordinal + 1;
    end loop;
  end loop;
end;
$$;

create or replace function public.v2_reset_workspace(p_confirmation text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_confirmation <> 'RESET WORKSPACE' then raise exception 'invalid reset confirmation'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));
  perform set_config('nebula.v2_maintenance', 'on', true);

  delete from public.v2_import_batch_transactions where user_id = v_user;
  delete from public.v2_import_batches where user_id = v_user;
  delete from public.v2_weekly_reviews where user_id = v_user;
  delete from public.v2_goals where user_id = v_user;
  delete from public.v2_trading_settings where user_id = v_user;
  delete from public.v2_transaction_legs where user_id = v_user;
  delete from public.v2_transactions where user_id = v_user;
  delete from public.v2_price_quotes where user_id = v_user;
  delete from public.v2_fx_rates where user_id = v_user;
  delete from public.v2_assets where user_id = v_user;
  delete from public.v2_accounts where user_id = v_user;
end;
$$;

revoke all on function public.v2_get_advanced_state() from public, anon, authenticated;
revoke all on function public.v2_put_goal(jsonb) from public, anon, authenticated;
revoke all on function public.v2_archive_goal(text) from public, anon, authenticated;
revoke all on function public.v2_put_trading_settings(jsonb) from public, anon, authenticated;
revoke all on function public.v2_put_weekly_review(jsonb) from public, anon, authenticated;
revoke all on function public.v2_finalize_weekly_review(text) from public, anon, authenticated;
revoke all on function public.v2_delete_weekly_review(text) from public, anon, authenticated;
revoke all on function public.v2_import_batch(jsonb) from public, anon, authenticated;
revoke all on function public.v2_rollback_import_batch(text) from public, anon, authenticated;
revoke all on function public.v2_export_backup() from public, anon, authenticated;
revoke all on function public.v2_restore_backup(jsonb) from public, anon, authenticated;
revoke all on function public.v2_reset_workspace(text) from public, anon, authenticated;

grant execute on function public.v2_get_advanced_state() to authenticated;
grant execute on function public.v2_put_goal(jsonb) to authenticated;
grant execute on function public.v2_archive_goal(text) to authenticated;
grant execute on function public.v2_put_trading_settings(jsonb) to authenticated;
grant execute on function public.v2_put_weekly_review(jsonb) to authenticated;
grant execute on function public.v2_finalize_weekly_review(text) to authenticated;
grant execute on function public.v2_delete_weekly_review(text) to authenticated;
grant execute on function public.v2_import_batch(jsonb) to authenticated;
grant execute on function public.v2_rollback_import_batch(text) to authenticated;
grant execute on function public.v2_export_backup() to authenticated;
grant execute on function public.v2_restore_backup(jsonb) to authenticated;
grant execute on function public.v2_reset_workspace(text) to authenticated;