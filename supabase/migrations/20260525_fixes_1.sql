-- fixes-1: seed required platform settings, including admin SMS phone.
insert into public.platform_settings (key, value, description)
values
  ('activation_fee_ksh', '500', 'One-time M-Pesa activation fee charged before an account can access live earning features.'),
  ('allow_new_registrations', 'true', 'Controls whether new user registrations are allowed.'),
  ('daily_task_limit', '2', 'Maximum number of tasks a user can submit per day.'),
  ('fraud_ai_mode', 'manual', 'Controls fraud AI scanning mode: auto, manual, or disabled.'),
  ('high_task_payout_threshold', '100', 'Min payout KSh for a task to require community size gate.'),
  ('high_task_referral_requirement', '5', 'Activated referrals needed to access high-payout tasks.'),
  ('max_task_batch_value_ksh', '500', 'Maximum total payout value per task (payout x slots).'),
  ('max_task_payout_ksh', '100', 'Maximum payout per task slot in KSh.'),
  ('min_withdrawal_amount_ksh', '50', 'Minimum KSh available balance required to request withdrawal.'),
  ('min_withdrawal_ksh', '200', 'Minimum withdrawal amount in KSh.'),
  ('referral_level_1_reward_ksh', '200', 'KSh rewarded to referrer when a level-1 referee activates.'),
  ('referral_task_unlock_reduction', '0.5', 'Fraction of remaining timer reduced when referral activates during wait period.'),
  ('task_unlock_delay_hours', '24', 'Hours after training completion before task access is granted.'),
  ('training_completion_reward_ksh', '50', 'KSh reward credited when user completes 7-day training.'),
  ('training_day_unlock_minutes', '1440', 'Minutes users must wait before the next training step unlocks.'),
  ('withdrawal_fee_ksh', '50', 'Flat fee deducted per withdrawal in KSh.'),
  ('withdrawal_hold_days', '1', 'Days a withdrawal is held before being processed.'),
  ('withdrawal_max_daily_amount', '200', 'Max KSh a user can withdraw total per day.'),
  ('withdrawal_max_daily_count', '2', 'Max number of withdrawal requests per user per day.'),
  ('withdrawal_max_single_amount', '1000', 'Max KSh a user can withdraw in a single request.'),
  ('withdrawal_min_amount', '200', 'Minimum withdrawal amount in KSh.'),
  ('withdrawal_n8n_webhook_url', '', 'Optional n8n webhook URL triggered after a withdrawal request is created.'),
  ('withdrawal_processing_days', '1', 'Days admin has to process a withdrawal after it is requested.'),
  ('withdrawals_enabled', 'false', 'Enable or disable all platform withdrawals (true/false).'),
  ('admin_sms_phone', '', 'Admin phone number for SMS notifications (format: 07XXXXXXXX).')
on conflict (key) do nothing;
