import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveGeminiKey } from '../_shared/ai-key.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Admin-only. Body: { api_key?: string } — tests the given key, or the saved one when omitted.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ ok: false, error: 'Não autenticado.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: claims, error } = await userClient.auth.getClaims(auth.replace('Bearer ', ''));
    if (error || !claims?.claims?.sub) return json({ ok: false, error: 'Sessão inválida.' }, 401);
    const { data: isAdmin } = await userClient.rpc('has_role', { _user_id: claims.claims.sub, _role: 'admin' });
    if (!isAdmin) return json({ ok: false, error: 'Acesso restrito ao administrador.' }, 403);

    const body = await req.json().catch(() => ({}));
    const given = typeof body?.api_key === 'string' ? body.api_key.trim() : '';
    if (given.length > 300) return json({ ok: false, error: 'Chave inválida.' }, 400);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const key = given || (await resolveGeminiKey(admin));
    if (!key) return json({ ok: false, error: 'Nenhuma chave cadastrada.' });

    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key } });
    if (res.ok) return json({ ok: true, source: given ? 'informada' : 'salva' });
    const status = res.status;
    return json({ ok: false, error: status === 400 || status === 403 ? 'Chave recusada pelo Google.' : status === 429 ? 'Limite de uso atingido.' : `Google respondeu ${status}.` });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
