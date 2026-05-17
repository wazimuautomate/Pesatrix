begin;

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check
  check (
    type in (
      'task_earning',
      'referral_bonus',
      'activation_fee',
      'deposit',
      'withdrawal',
      'admin_adjustment',
      'reward',
      'reversal'
    )
  );

notify pgrst, 'reload schema';

commit;
