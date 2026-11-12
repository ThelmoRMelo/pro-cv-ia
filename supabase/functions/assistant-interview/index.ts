import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveGeminiKey } from '../_shared/ai-key.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Public endpoint. Body: { messages: [{role:'user'|'assistant', text}], resume?: object }
// Returns: { ok, reply, resume_patch, done }
const FIELDS = `{
 "fullName": string, "jobTitle": string, "email": string, "phone": string, "address": string,
 "linkedin": string, "portfolio": string, "summary": string,
 "experiences": [{"company": string, "role": string, "period": string, "description": string}],
 "education": [{"institution": string, "course": string, "period": string}],
 "courses": [string], "skills": [string], "languages": [string]
}`;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método inválido.' }, 405);
  try {
    const body = await req.json().catch(() => null);
    const raw = Array.isArray(body?.messages) ? body.messages : null;
    if (!raw || raw.length === 0 || raw.length > 60) return json({ ok: false, error: 'Mensagens inválidas.' }, 400);
    const messages = raw.map((m: any) => ({ role: m?.role === 'assistant' ? 'model' : 'user', text: str(m?.text, 4000).trim() }))
      .filter((m: any) => m.text);
    if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ ok: false, error: 'Última mensagem deve ser do candidato.' }, 400);
    const resume = body?.resume && typeof body.resume === 'object' ? body.resume : {};
    const resumeStr = JSON.stringify(resume).slice(0, 20000);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: s } = await admin.from('ai_settings')
      .select('model, temperature, system_prompt, personality_tone, assistant_name, assistant_enabled').eq('id', 'default').maybeSingle();
    if (s && s.assistant_enabled === false) return json({ ok: false, error: 'Assistente desativada.' }, 403);
    const key = await resolveGeminiKey(admin);
    if (!key) return json({ ok: false, error: 'Assistente indisponível no momento.' }, 503);

    const name = s?.assistant_name || 'Anya';
    const system = `Seu nome é ${name}. Tom: ${s?.personality_tone || 'acolhedor'}.
${s?.system_prompt || ''}

Dados já coletados do currículo (JSON): ${resumeStr}

REGRAS DE SAÍDA: responda SOMENTE com um JSON válido no formato
{"reply": "sua próxima fala ao candidato, curta, uma pergunta por vez", "resume_patch": {campos novos ou corrigidos}, "done": boolean}
O resume_patch segue este esquema (inclua apenas campos que o candidato informou nesta conversa; listas devem vir completas): ${FIELDS}
Nunca invente dados. "done" = true só quando o candidato confirmar que está tudo certo.`;

    const model = s?.model || 'gemini-2.0-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m: any) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: { temperature: Number(s?.temperature ?? 0.7), responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      const st = res.status;
      return json({ ok: false, error: st === 429 ? 'Muitas conversas agora. Tente em instantes.' : 'Assistente indisponível no momento.' }, st === 429 ? 429 : 502);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    if (!parsed || typeof parsed.reply !== 'string') return json({ ok: true, reply: text.trim() || 'Pode repetir, por favor?', resume_patch: {}, done: false });
    const patch = parsed.resume_patch && typeof parsed.resume_patch === 'object' && !Array.isArray(parsed.resume_patch) ? parsed.resume_patch : {};
    return json({ ok: true, reply: parsed.reply.slice(0, 2000), resume_patch: patch, done: parsed.done === true });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: 'Erro inesperado.' }, 500);
  }
});
