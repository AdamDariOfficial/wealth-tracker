revoke execute on function public.handle_new_user()           from public, anon, authenticated;
revoke execute on function public.tg_tx_recompute()             from public, anon, authenticated;
revoke execute on function public.tg_audit_entity()             from public, anon, authenticated;
revoke execute on function public.recompute_account_balance(uuid) from public, anon, authenticated;