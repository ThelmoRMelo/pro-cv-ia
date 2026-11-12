import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveGeminiKey } from '../_shared/ai-key.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const FIELDS = `{
 "fullName": string, "jobTitle": string, "email": string, "phone": string, "address": string,
 "linkedin": string, "portfolio": string, "summary": string,
 "experiences": [{"company": string, "role": string, "period": string, "description": string}],
 "education": [{"institution": string, "course": string, "period": string}],
 "courses": [string], "skills": [string], "languages": [string]
}`;

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método inválido.' }, 405);

  try {
    const body = await req.json().catch(() => null);
    const raw = Array.isArray(body?.messages) ? body.messages : null;
    if (!raw || raw.length === 0 || raw.length > 60) {
      return json({ ok: false, error: 'Mensagens inválidas.' }, 400);
    }

    const normalized = raw
      .map((message: any) => ({
        role: message?.role === 'assistant' ? 'model' : 'user',
        text: str(message?.text, 4000).trim(),
      }))
      .filter((message: any) => Boolean(message.text));

    if (!normalized.length) {
      return json({ ok: false, error: 'Nenhuma mensagem válida fornecida.' }, 400);
    }

    let initialGreeting = '';
    let startIndex = 0;
    if (normalized[0].role === 'model') {
      initialGreeting = normalized[0].text;
      startIndex = 1;
    }

    const conversationTurns = normalized.slice(startIndex);
    if (!conversationTurns.length || conversationTurns[conversationTurns.length - 1].role !== 'user') {
      return json({ ok: false, error: 'A última mensagem deve ser enviada pelo usuário.' }, 400);
    }

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const turn of conversationTurns) {
      const last = contents[contents.length - 1];
      if (last && last.role === turn.role) {
        last.parts[0].text += `\n${turn.text}`;
      } else {
        contents.push({ role: turn.role, parts: [{ text: turn.text }] });
      }
    }

    if (contents.length === 0 || contents[0].role !== 'user') {
      return json({ ok: false, error: 'A primeira resposta precisa ser do usuário.' }, 400);
    }

    const resume = body?.resume && typeof body.resume === 'object' ? body.resume : {};
    const resumeStr = JSON.stringify(resume).slice(0, 20000);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: settings } = await admin
      .from('ai_settings')
      .select('model, temperature, system_prompt, personality_tone, assistant_name, assistant_enabled')
      .eq('id', 'default')
      .maybeSingle();

    if (settings && settings.assistant_enabled === false) {
      return json({ ok: false, error: 'Assistente desativada temporariamente.' }, 200);
    }

    const key = await resolveGeminiKey(admin);
    if (!key) return json({ ok: false, error: 'Chave de IA não configurada no painel.' }, 200);

    const name = settings?.assistant_name || 'Anya';
    const greetingContext = initialGreeting
      ? `Você já enviou esta saudação inicial ao candidato e ele acabou de responder: "${initialGreeting}"\n`
      : '';
    const system = `Seu nome é ${name}. Tom de conversa: ${settings?.personality_tone || 'acolhedor e profissional'}.
${greetingContext}${settings?.system_prompt || ''}

Dados já coletados do currículo do candidato (JSON): ${resumeStr}

REGRAS DE RESPOSTA OBRIGATÓRIAS:
Responda ESTRITAMENTE em formato JSON com a seguinte estrutura:
{
  "reply": "Sua próxima fala para o candidato. Seja empático, amigável, conciso e faça UMA pergunta por vez para coletar as informações do currículo.",
  "resume_patch": {campos atualizados ou novos que o candidato informou nesta mensagem},
  "done": false
}

O campo resume_patch deve seguir este esquema (inclua apenas campos novos/alterados):
${FIELDS}

Nunca invente dados que o candidato não disse. Marque "done": true apenas quando o candidato confirmar que o currículo está completo.`;

    const preferred = settings?.model || 'gemini-flash-latest';
    const candidates = [...new Set([preferred, 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest'])];
    let response!: Response;
    for (const model of candidates) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: {
            temperature: Number(settings?.temperature ?? 0.7),
            responseMimeType: 'application/json',
          },
        }),
      });
      if (response.status !== 404) break;
      console.warn(`[assistant-interview] Modelo indisponível: ${model}, tentando próximo.`);
      await response.text();
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[assistant-interview] Erro Google Gemini ${response.status}:`, errorText);

      if ([400, 401, 403].includes(response.status)) {
        return json({ ok: false, error: 'A chave do Google Gemini foi recusada. Verifique a chave no painel administrativo.' }, 200);
      }
      if (response.status === 429) {
        return json({ ok: false, error: 'Recebi muitas solicitações agora. Aguarde alguns segundos e tente novamente.' }, 200);
      }
      return json({ ok: false, error: 'Estou temporariamente indisponível. Tente novamente em instantes.' }, 200);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? '').join('') ?? '';

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          /* Ignore malformed model output and return a friendly fallback. */
        }
      }
    }

    if (!parsed || typeof parsed.reply !== 'string') {
      return json({
        ok: true,
        reply: text.trim() || 'Entendi. Pode me contar mais detalhes?',
        resume_patch: {},
        done: false,
      });
    }

    const patch = parsed.resume_patch && typeof parsed.resume_patch === 'object' && !Array.isArray(parsed.resume_patch)
      ? parsed.resume_patch
      : {};

    return json({ ok: true, reply: parsed.reply.slice(0, 2000), resume_patch: patch, done: parsed.done === true });
  } catch (error) {
    console.error('[assistant-interview] Exceção inesperada:', error);
    return json({ ok: false, error: 'Ocorreu um erro inesperado ao processar a conversa.' }, 200);
  }
});
