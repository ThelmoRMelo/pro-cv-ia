CREATE TABLE public.ai_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  gemini_api_key text,
  model text NOT NULL DEFAULT 'gemini-2.0-flash',
  personality_tone text NOT NULL DEFAULT 'Empática e acolhedora',
  voice_style text NOT NULL DEFAULT 'Encorajadora e profissional',
  temperature numeric(3,2) NOT NULL DEFAULT 0.70 CHECK (temperature >= 0 AND temperature <= 1),
  system_prompt text NOT NULL DEFAULT 'Você é uma entrevistadora de currículos experiente e acolhedora. Conduza a conversa com uma pergunta por vez, em português do Brasil, para coletar: nome, cargo desejado, contatos (e-mail, telefone, endereço, LinkedIn, portfólio), resumo profissional, experiências (empresa, cargo, período, conquistas), formação, cursos, competências e idiomas. Ajude o candidato a descrever conquistas com verbos de ação e resultados. Nunca invente informações. Ao final, confirme os dados com o candidato.',
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: access only through admin RPCs and server functions.

CREATE OR REPLACE FUNCTION public.admin_get_ai_settings()
RETURNS TABLE(model text, personality_tone text, voice_style text, temperature numeric, system_prompt text, extra jsonb, has_api_key boolean, api_key_hint text, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.ai_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
  RETURN QUERY SELECT s.model, s.personality_tone, s.voice_style, s.temperature, s.system_prompt, s.extra,
    (coalesce(s.gemini_api_key,'') <> ''),
    CASE WHEN coalesce(s.gemini_api_key,'') = '' THEN NULL ELSE '••••' || right(s.gemini_api_key,4) END,
    s.updated_at
  FROM public.ai_settings s WHERE s.id='default';
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_get_ai_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_settings() TO authenticated;

-- _api_key: NULL = keep current, '' = remove, other = replace
CREATE OR REPLACE FUNCTION public.admin_save_ai_settings(_api_key text, _model text, _personality_tone text, _voice_style text, _temperature numeric, _system_prompt text, _extra jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _temperature IS NOT NULL AND (_temperature < 0 OR _temperature > 1) THEN RAISE EXCEPTION 'invalid temperature'; END IF;
  IF _api_key IS NOT NULL AND length(_api_key) > 300 THEN RAISE EXCEPTION 'invalid api key'; END IF;
  IF _system_prompt IS NOT NULL AND length(_system_prompt) > 20000 THEN RAISE EXCEPTION 'prompt too long'; END IF;
  INSERT INTO public.ai_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
  UPDATE public.ai_settings SET
    gemini_api_key = CASE WHEN _api_key IS NULL THEN gemini_api_key WHEN btrim(_api_key) = '' THEN NULL ELSE btrim(_api_key) END,
    model = coalesce(nullif(btrim(_model),''), model),
    personality_tone = coalesce(_personality_tone, personality_tone),
    voice_style = coalesce(_voice_style, voice_style),
    temperature = coalesce(_temperature, temperature),
    system_prompt = coalesce(_system_prompt, system_prompt),
    extra = coalesce(_extra, extra),
    updated_at = now(), updated_by = auth.uid()
  WHERE id='default';
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_save_ai_settings(text,text,text,text,numeric,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_ai_settings(text,text,text,text,numeric,text,jsonb) TO authenticated;