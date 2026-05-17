begin;

alter table public.task_submissions
  add column if not exists grading_detail jsonb;

notify pgrst, 'reload schema';

commit;
