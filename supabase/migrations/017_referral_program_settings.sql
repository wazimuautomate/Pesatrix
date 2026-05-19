insert into public.platform_settings (key, value, description)
values
  ('referral_max_levels', '3', 'Maximum depth of the referral programme. Supported range is 1 to 3.'),
  ('referral_activation_rule', 'activation_paid', 'Rule used to unlock referral bonuses. activation_paid means bonuses clear only after the referred user completes paid activation.'),
  ('referral_level_1_reward_ksh', '100', 'Level 1 referral reward in KSh after activation.'),
  ('referral_level_2_reward_ksh', '50', 'Level 2 referral reward in KSh after activation.'),
  ('referral_level_3_reward_ksh', '25', 'Level 3 referral reward in KSh after activation.')
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description;

create index if not exists profiles_referred_by_created_at_idx
  on public.profiles (referred_by, created_at desc);

create index if not exists referral_bonuses_referrer_level_created_at_idx
  on public.referral_bonuses (referrer_id, level, created_at desc);
