-- Add task unlock tracking columns to training_progress
ALTER TABLE public.training_progress
  ADD COLUMN IF NOT EXISTS task_unlock_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS task_unlock_accelerated boolean NOT NULL DEFAULT false;