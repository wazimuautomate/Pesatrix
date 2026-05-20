create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  description text,
  updated_by_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists platform_settings_touch_updated_at on public.platform_settings;
do $$
begin
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'touch_updated_at'
  ) then
    create trigger platform_settings_touch_updated_at
    before update on public.platform_settings
    for each row
    execute function public.touch_updated_at();
  end if;
end $$;

alter table public.platform_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_settings'
      and policyname = 'Platform settings readable by active admins'
  ) then
    create policy "Platform settings readable by active admins"
    on public.platform_settings
    for select
    using (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and au.status = 'active'
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_settings'
      and policyname = 'Platform settings writable by super admins'
  ) then
    create policy "Platform settings writable by super admins"
    on public.platform_settings
    for all
    using (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and au.status = 'active'
          and au.role = 'admin'
      )
    )
    with check (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and au.status = 'active'
          and au.role = 'admin'
      )
    );
  end if;
end $$;

insert into public.platform_settings (key, value, description)
values (
  'training_day_unlock_minutes',
  '1',
  'Minutes users must wait before the next training step unlocks.'
)
on conflict (key) do nothing;
