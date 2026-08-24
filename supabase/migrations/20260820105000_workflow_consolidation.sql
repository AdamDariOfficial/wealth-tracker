-- Wealth Tracker workflow consolidation: safe asset deletion + atomic weekly save.
-- Source-only controlled change. Applying this migration is a separate explicit gate.

create or replace function public.v2_delete_unused_asset(p_asset_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_symbol text;
  v_kind text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));
  if p_asset_id is null or p_asset_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'invalid asset id';
  end if;

  select symbol, kind into v_symbol, v_kind
  from public.v2_assets
  where user_id = v_user and id = p_asset_id
  for update;
  if not found then raise exception 'asset not found'; end if;

  if exists (select 1 from public.v2_transaction_legs where user_id = v_user and asset_id = p_asset_id) then
    raise exception 'asset has transaction history';
  end if;
  if exists (select 1 from public.v2_goals where user_id = v_user and target_asset_id = p_asset_id) then
    raise exception 'asset is referenced by a goal';
  end if;
  if v_kind = 'fiat' and exists (
    select 1 from public.v2_profiles where user_id = v_user and base_currency = v_symbol
  ) then
    raise exception 'base currency asset cannot be deleted';
  end if;
  if exists (
    select 1 from public.v2_trading_settings where user_id = v_user and upper(primary_asset) = v_symbol
  ) then
    raise exception 'asset is referenced by trading settings';
  end if;

  -- Quotes are observations owned by this otherwise-unused asset. The canonical
  -- history trigger permits this only inside the maintenance boundary.
  perform set_config('nebula.v2_maintenance', 'on', true);
  delete from public.v2_price_quotes where user_id = v_user and asset_id = p_asset_id;
  delete from public.v2_assets where user_id = v_user and id = p_asset_id;
end;
$$;

create or replace function public.v2_save_weekly_review(p_review jsonb, p_finalize boolean default true)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_review ->> 'id';
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_finalize is null then raise exception 'finalize choice is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nebula-v2-write:' || v_user::text, 0));

  -- Both calls run inside this same PostgreSQL transaction. If finalization
  -- fails, the draft write rolls back with it.
  perform public.v2_put_weekly_review(p_review);
  if p_finalize then
    perform public.v2_finalize_weekly_review(v_id);
  end if;
end;
$$;

revoke all on function public.v2_delete_unused_asset(text) from public, anon, authenticated;
revoke all on function public.v2_save_weekly_review(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.v2_delete_unused_asset(text) to authenticated;
grant execute on function public.v2_save_weekly_review(jsonb, boolean) to authenticated;
