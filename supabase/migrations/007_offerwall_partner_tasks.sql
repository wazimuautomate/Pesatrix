begin;

-- CPX postbacks use wallet_transactions as the payout ledger.
-- Keep provider transaction IDs unique so retries cannot double-credit users.
create unique index if not exists wallet_transactions_cpx_reference_unique_idx
  on public.wallet_transactions (reference_table, reference_id)
  where reference_table = 'cpx_research';

notify pgrst, 'reload schema';

commit;
