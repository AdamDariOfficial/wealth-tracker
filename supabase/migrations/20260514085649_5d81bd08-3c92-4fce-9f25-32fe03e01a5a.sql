
create or replace function public.tg_tx_recompute()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_account_balance(old.source_account_id);
    perform public.recompute_account_balance(old.destination_account_id);
    return old;
  end if;
  perform public.recompute_account_balance(new.source_account_id);
  perform public.recompute_account_balance(new.destination_account_id);
  if tg_op = 'UPDATE' then
    if new.source_account_id is distinct from old.source_account_id then
      perform public.recompute_account_balance(old.source_account_id);
    end if;
    if new.destination_account_id is distinct from old.destination_account_id then
      perform public.recompute_account_balance(old.destination_account_id);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.tg_tx_recompute() from public, anon, authenticated;
