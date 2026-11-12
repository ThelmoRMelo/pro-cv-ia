ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS assistant_name text NOT NULL DEFAULT 'Anya',
  ADD COLUMN IF NOT EXISTS assistant_avatar_url text,
  ADD COLUMN IF NOT EXISTS assistant_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_message text NOT NULL DEFAULT 'Olá! Eu sou a Anya. Posso montar seu currículo com você numa conversa rápida?';

CREATE OR REPLACE FUNCTION public.admin_get_assistant_identity()
RETURNS TABLE(assistant_name text, assistant_avatar_url text, assistant_enabled boolean, welcome_message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.ai_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
  RETURN QUERY SELECT s.assistant_name, s.assistant_avatar_url, s.assistant_enabled, s.welcome_message
  FROM public.ai_settings s WHERE s.id='default';
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_get_assistant_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_assistant_identity() TO authenticated;

-- NULL = keep; for avatar '' = remove
CREATE OR REPLACE FUNCTION public.admin_save_assistant_identity(_name text, _avatar_url text, _enabled boolean, _welcome text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _name IS NOT NULL AND (length(btrim(_name)) = 0 OR length(_name) > 40) THEN RAISE EXCEPTION 'invalid name'; END IF;
  IF _avatar_url IS NOT NULL AND length(_avatar_url) > 1000 THEN RAISE EXCEPTION 'invalid avatar'; END IF;
  IF _welcome IS NOT NULL AND length(_welcome) > 500 THEN RAISE EXCEPTION 'welcome too long'; END IF;
  INSERT INTO public.ai_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
  UPDATE public.ai_settings SET
    assistant_name = coalesce(nullif(btrim(_name),''), assistant_name),
    assistant_avatar_url = CASE WHEN _avatar_url IS NULL THEN assistant_avatar_url WHEN btrim(_avatar_url)='' THEN NULL ELSE btrim(_avatar_url) END,
    assistant_enabled = coalesce(_enabled, assistant_enabled),
    welcome_message = coalesce(_welcome, welcome_message),
    updated_at = now(), updated_by = auth.uid()
  WHERE id='default';
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_save_assistant_identity(text,text,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_assistant_identity(text,text,boolean,text) TO authenticated;

-- Public: only visual data, never secrets
CREATE OR REPLACE FUNCTION public.get_public_assistant_config()
RETURNS TABLE(assistant_name text, assistant_avatar_url text, enabled boolean, welcome_message text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(s.assistant_name,'Anya'), s.assistant_avatar_url,
         (s.assistant_enabled AND coalesce(s.gemini_api_key,'') <> ''), s.welcome_message
  FROM public.ai_settings s WHERE s.id='default'
  UNION ALL
  SELECT 'Anya', NULL, false, 'Olá! Eu sou a Anya.' WHERE NOT EXISTS (SELECT 1 FROM public.ai_settings WHERE id='default');
$$;
GRANT EXECUTE ON FUNCTION public.get_public_assistant_config() TO anon, authenticated;

CREATE POLICY "Public read assistant avatars" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id='template-references' AND name LIKE 'assistant/%');
CREATE POLICY "Admin upload assistant avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='template-references' AND name LIKE 'assistant/%' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete assistant avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='template-references' AND name LIKE 'assistant/%' AND public.has_role(auth.uid(),'admin'));