begin;

alter table public.activation_payments
  drop constraint if exists activation_payments_phone_check;

alter table public.activation_payments
  add constraint activation_payments_phone_check
  check (phone ~ '^\+?254[17][0-9]{8}$');

notify pgrst, 'reload schema';

commit;
