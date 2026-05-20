-- FIXED: Persist Watch & Respond sessions so watch time and cheat strikes are validated server-side.
CREATE TABLE IF NOT EXISTS public.watch_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  task_id uuid NOT NULL REFERENCES public.tasks(id),
  started_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  completed_at timestamptz,
  duration_seconds integer,
  cheat_strikes integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(user_id, task_id)
);

ALTER TABLE public.watch_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Watch sessions readable by owner" ON public.watch_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Watch sessions writable by service role" ON public.watch_sessions
  FOR ALL USING (auth.role() = 'service_role');
