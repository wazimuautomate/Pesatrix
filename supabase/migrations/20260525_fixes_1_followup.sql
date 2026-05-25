-- Allow Gemini as an AI provider in existing installs that use a provider CHECK constraint.
do $$
begin
  if to_regclass('public.ai_provider_configs') is not null then
    alter table public.ai_provider_configs
      drop constraint if exists ai_provider_configs_provider_check;

    alter table public.ai_provider_configs
      add constraint ai_provider_configs_provider_check
      check (provider in ('nvidia', 'openrouter', 'groq', 'gemini', 'ollama'));
  end if;
end $$;
