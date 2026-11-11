CREATE UNIQUE INDEX IF NOT EXISTS plans_slug_key ON public.plans(slug);
CREATE UNIQUE INDEX IF NOT EXISTS pix_configs_plan_id_key ON public.pix_configs(plan_id);

CREATE OR REPLACE FUNCTION public.seed_default_plans()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.plans (slug, name, price_cents, sort_order, is_active) VALUES
    ('basico','Básico',200,1,true),
    ('intermediario','Intermediário',300,2,true),
    ('profissional','Profissional',500,3,true)
  ON CONFLICT (slug) DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_default_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_plans() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_plan_and_pix(_slug text, _price_cents integer, _pix_key text, _recipient_name text, _qr_code_object_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _plan_id uuid;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _slug NOT IN ('basico','intermediario','profissional') THEN RAISE EXCEPTION 'invalid plan'; END IF;
  IF _price_cents IS NULL OR _price_cents < 0 THEN RAISE EXCEPTION 'invalid price'; END IF;
  PERFORM public.seed_default_plans();
  UPDATE plans SET price_cents=_price_cents, is_active=true, updated_at=now() WHERE slug=_slug RETURNING id INTO _plan_id;
  INSERT INTO pix_configs (plan_id, pix_key, recipient_name, qr_code_object_path, is_active, updated_at)
  VALUES (_plan_id, coalesce(_pix_key,''), coalesce(_recipient_name,''), _qr_code_object_path, true, now())
  ON CONFLICT (plan_id) DO UPDATE SET pix_key=EXCLUDED.pix_key, recipient_name=EXCLUDED.recipient_name,
    qr_code_object_path=EXCLUDED.qr_code_object_path, is_active=true, updated_at=now();
  RETURN _plan_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_save_plan_and_pix(text,integer,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_plan_and_pix(text,integer,text,text,text) TO authenticated;