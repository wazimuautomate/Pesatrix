create unique index if not exists wallet_transactions_training_reward_unique_idx
  on public.wallet_transactions (user_id, reference_table, reference_id, type, direction)
  where reference_table = 'training_progress'
    and type = 'task_earning'
    and direction = 'credit';
