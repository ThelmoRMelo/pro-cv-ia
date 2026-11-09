ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS creation_type text,
  ADD COLUMN IF NOT EXISTS clean_background_url text,
  ADD COLUMN IF NOT EXISTS template_schema jsonb;

ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_creation_type_check;
ALTER TABLE public.templates
  ADD CONSTRAINT templates_creation_type_check
  CHECK (creation_type IS NULL OR creation_type IN ('ai','manual'));

-- Backfill: only templates that already have operational HTML (from the AI flow) become 'ai'.
UPDATE public.templates
  SET creation_type = 'ai'
  WHERE creation_type IS NULL
    AND generated_html IS NOT NULL
    AND length(btrim(generated_html)) > 0;

COMMENT ON COLUMN public.templates.creation_type IS 'NULL = pending configuration; ai = configured by AI; manual = configured by visual editor';
COMMENT ON COLUMN public.templates.clean_background_url IS 'Clean background image used by manual templates';
COMMENT ON COLUMN public.templates.template_schema IS 'Versioned editable schema of manual templates';