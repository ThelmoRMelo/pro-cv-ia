CREATE OR REPLACE FUNCTION public.get_public_assistant_config()
RETURNS TABLE(assistant_name text, assistant_avatar_url text, enabled boolean, welcome_message text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(s.assistant_name,'Anya'), s.assistant_avatar_url, s.assistant_enabled, s.welcome_message
  FROM public.ai_settings s WHERE s.id='default'
  UNION ALL
  SELECT 'Anya', NULL, true, 'Olá! Eu sou a Anya. Posso montar seu currículo com você numa conversa rápida?'
  WHERE NOT EXISTS (SELECT 1 FROM public.ai_settings WHERE id='default');
$$;
GRANT EXECUTE ON FUNCTION public.get_public_assistant_config() TO anon, authenticated;