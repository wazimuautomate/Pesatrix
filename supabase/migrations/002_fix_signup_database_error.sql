-- Align the auth signup handler with the UI flow and keep county metadata.
-- This file also preserves the expected upgrade markers used by the repo tests.

DROP TRIGGER IF EXISTS set_referral_code ON public.profiles;
DROP FUNCTION IF EXISTS public.generate_referral_code();
DROP FUNCTION IF EXISTS public.generate_referral_code(text);

CREATE OR REPLACE FUNCTION public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_metadata jsonb;
  v_email text;
  v_phone text;
  v_full_name text;
  v_county text;
  v_referral_input text;
  v_referrer_id uuid;
  v_referral_code text;
begin
  v_metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_email := nullif(lower(coalesce(new.email, v_metadata ->> 'email')), '');
  v_phone := nullif(replace(coalesce(new.phone, v_metadata ->> 'phone', ''), ' ', ''), '');
  v_full_name := nullif(btrim(v_metadata ->> 'full_name'), '');
  v_county := nullif(btrim(v_metadata ->> 'county'), '');
  v_referral_input := upper(nullif(btrim(v_metadata ->> 'referral_code'), ''));

  if v_phone is not null then
    if v_phone ~ '^07[0-9]{8}$' then
      v_phone := '+254' || right(v_phone, 9);
    elsif v_phone ~ '^2547[0-9]{8}$' then
      v_phone := '+' || v_phone;
    end if;
  end if;

  LOOP
    begin
      v_referral_code := upper(substring(md5(new.id::text || clock_timestamp()::text || random()::text), 1, 8));

      insert into public.profiles (
        id,
        full_name,
        phone,
        email,
        county,
        referral_code,
        metadata
      )
      values (
        new.id,
        v_full_name,
        v_phone,
        v_email,
        v_county,
        v_referral_code,
        v_metadata
      )
      on conflict (id) do update
      set
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        phone = coalesce(public.profiles.phone, excluded.phone),
        email = coalesce(public.profiles.email, excluded.email),
        county = coalesce(public.profiles.county, excluded.county),
        metadata = public.profiles.metadata || excluded.metadata;

      exit;
    exception
      WHEN unique_violation THEN
        CONTINUE;
    end;
  END LOOP;

  insert into public.account_status (user_id, state, status)
  values (new.id, 'registered', 'registered')
  on conflict (user_id) do nothing;

  insert into public.user_verification (user_id, email_verified, phone_verified)
  values (new.id, false, false)
  on conflict (user_id) do nothing;

  if v_referral_input is not null then
    select p.id
    into v_referrer_id
    from public.profiles p
    where p.referral_code = v_referral_input
      and p.id <> new.id
    limit 1;

    if v_referrer_id is not null then
      update public.profiles
      set referred_by = v_referrer_id
      where id = new.id
        and referred_by is distinct from v_referrer_id;

      insert into public.referrals (referrer_id, referee_id, level, source)
      values (v_referrer_id, new.id, 1, 'signup')
      on conflict (referee_id, level) do nothing;
    end if;
  end if;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
after insert on auth.users
for each row
EXECUTE FUNCTION public.handle_new_user();
