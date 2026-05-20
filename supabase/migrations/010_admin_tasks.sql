create table if not exists public.admin_tasks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  source text not null default 'general' check (source in ('general', 'partner')),
  provider text,
  category text not null,
  payout integer not null default 0 check (payout >= 0),
  estimated_time text not null default 'Varies',
  difficulty text not null default 'Easy' check (difficulty in ('Easy', 'Medium', 'Hard')),
  summary text not null,
  admin_note text,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'archived')),
  created_by_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_tasks_status_source_idx
  on public.admin_tasks (status, source, updated_at desc);

drop trigger if exists admin_tasks_touch_updated_at on public.admin_tasks;
do $$
begin
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'touch_updated_at'
  ) then
    create trigger admin_tasks_touch_updated_at
    before update on public.admin_tasks
    for each row
    execute function public.touch_updated_at();
  end if;
end $$;

alter table public.admin_tasks enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_tasks'
      and policyname = 'Admin tasks readable by active admins'
  ) then
    create policy "Admin tasks readable by active admins"
    on public.admin_tasks
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
      and tablename = 'admin_tasks'
      and policyname = 'Admin tasks writable by active admins'
  ) then
    create policy "Admin tasks writable by active admins"
    on public.admin_tasks
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

insert into public.admin_tasks
  (slug, title, source, provider, category, payout, estimated_time, difficulty, summary, admin_note, status)
values
  ('survey-consumer-habits', 'Survey -- Consumer Habits 2026', 'general', null, 'Surveys', 35, '12 min', 'Easy', 'Short structured survey requiring clean qualification flow and honest responses.', null, 'active'),
  ('ads-brand-engagement', 'Ads -- Brand Engagement Review', 'general', null, 'Ads', 40, '15 min', 'Easy', 'Provider-tracked ad interaction that rewards careful timer and evidence handling.', null, 'active'),
  ('transcription-voice-snippet', 'Transcription -- Voice Snippet Cleanup', 'general', null, 'Transcription', 80, '25 min', 'Medium', 'Clean a short audio snippet with punctuation, clarity, and escalation discipline.', null, 'active'),
  ('games-milestone-quest', 'Games -- Milestone Quest Run', 'general', null, 'Games', 90, '30 min', 'Medium', 'Reach a verified provider milestone and preserve proof without duplicate installs.', null, 'active'),
  ('mixed-provider-quality-audit', 'Mixed Provider -- Quality Audit', 'general', null, 'Supported Work', 120, '35 min', 'Hard', 'Advanced review task that blends instruction reading, evidence checks, and escalation judgment.', null, 'active'),
  ('partner-cpx-research', 'CPX Research Surveys', 'partner', 'cpx', 'Partner surveys', 0, 'Varies', 'Easy', 'Live CPX Research partner wall. Pesatrix admins configure and reconcile provider tasks, while completed surveys credit through CPX postbacks.', 'Requires CPX_APP_ID and CPX_SECURE_HASH in the server environment.', 'active')
on conflict (slug) do nothing;
