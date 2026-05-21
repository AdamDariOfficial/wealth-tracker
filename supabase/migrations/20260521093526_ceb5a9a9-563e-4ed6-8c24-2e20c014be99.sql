
alter table public.weekly_reports
  add column if not exists finalized_at timestamptz;

create or replace function public.tg_weekly_reports_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.finalized_at is not null then
      raise exception 'Weekly report is finalized and cannot be deleted. Unlock it first.';
    end if;
    return old;
  end if;

  -- UPDATE
  if old.finalized_at is not null then
    -- Allow only explicit unlock (clearing finalized_at). Block everything else.
    if new.finalized_at is null
       and (new.pnl, new.winrate, new.avg_rr, new.num_trades, new.max_drawdown,
            new.discipline_score, new.psychology_score, new.consistency_score,
            new.notes, new.lessons, new.screenshots, new.week_start,
            new.broker_account_id, new.posted_transaction_id, new.is_draft)
         is not distinct from
           (old.pnl, old.winrate, old.avg_rr, old.num_trades, old.max_drawdown,
            old.discipline_score, old.psychology_score, old.consistency_score,
            old.notes, old.lessons, old.screenshots, old.week_start,
            old.broker_account_id, old.posted_transaction_id, old.is_draft) then
      return new;
    end if;
    raise exception 'Weekly report % is finalized and immutable. Unlock it before editing.', old.id;
  end if;

  return new;
end $$;

drop trigger if exists weekly_reports_immutable on public.weekly_reports;
create trigger weekly_reports_immutable
  before update or delete on public.weekly_reports
  for each row execute function public.tg_weekly_reports_immutable();
