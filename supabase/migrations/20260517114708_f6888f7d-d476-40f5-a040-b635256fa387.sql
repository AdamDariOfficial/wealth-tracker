-- Attach handle_new_user to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Attach tg_tx_recompute to public.transactions
drop trigger if exists trg_transactions_recompute on public.transactions;
create trigger trg_transactions_recompute
  after insert or update or delete on public.transactions
  for each row execute function public.tg_tx_recompute();

-- Backfill existing users missing seed data
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

insert into public.trading_account (user_id)
select u.id from auth.users u
left join public.trading_account t on t.user_id = u.id
where t.user_id is null;

insert into public.onboarding_data (user_id)
select u.id from auth.users u
left join public.onboarding_data o on o.user_id = u.id
where o.user_id is null;

insert into public.assets (user_id, symbol, name, asset_class, color, current_price)
select u.id, x.symbol, x.name, x.asset_class::asset_class, x.color, x.current_price
from auth.users u
cross join (values
  ('USD','US Dollar','fiat','#10b981',1::numeric),
  ('EUR','Euro','fiat','#3b82f6',1.08::numeric),
  ('BTC','Bitcoin','crypto','#f7931a',0::numeric),
  ('ETH','Ethereum','crypto','#627eea',0::numeric),
  ('SOL','Solana','crypto','#9945ff',0::numeric)
) as x(symbol,name,asset_class,color,current_price)
on conflict (user_id, symbol) do nothing;