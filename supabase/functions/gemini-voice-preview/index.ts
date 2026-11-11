import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveGeminiKey } from '../_shared/ai-key.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const VOICES = ['Aoede', 'Kore', 'Puck', 'Charon', 'Fenrir', 'Leda', 'Zephyr', 'Orus'];
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

function pcmToWav(pcm: Uint8Array, rate = 24000): Uint8Array {
  const h = new DataView(new ArrayBuffer(44));
  const w = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); h.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt ');
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
  h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true);
  w(36, 'data'); h.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length); out.set(new Uint8Array(h.buffer)); out.set(pcm, 44); return out;
}

// Admin-only. Body: { voice: string, text?: string } -> { ok, audio_base64 (wav), mime }
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
    const voice = typeof body?.voice === 'string' ? body.voice : '';
    if (!VOICES.includes(voice)) return json({ ok: false, error: 'Voz inválida.' }, 400);
    const text = (typeof body?.text === 'string' && body.text.trim()
      ? body.text.trim()
      : 'Olá! Eu sou a sua assistente de currículos. Vamos conversar um pouco sobre a sua trajetória profissional?').slice(0, 500);

    const key = await resolveGeminiKey(createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!));
    if (!key) return json({ ok: false, error: 'Nenhuma chave Gemini cadastrada.' }, 400);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      }),
    });
    if (!res.ok) {
      const s = res.status;
      return json({ ok: false, error: s === 429 ? 'Limite de uso do Gemini atingido. Tente mais tarde.' : s === 400 || s === 403 ? 'Chave recusada pelo Google.' : `Google respondeu ${s}.` }, s === 429 ? 429 : 502);
    }
    const data = await res.json();
    const b64 = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data)?.inlineData?.data;
    if (!b64) return json({ ok: false, error: 'O Gemini não retornou áudio.' }, 502);
    const pcm = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const wav = pcmToWav(pcm);
    let bin = ''; for (let i = 0; i < wav.length; i += 0x8000) bin += String.fromCharCode(...wav.subarray(i, i + 0x8000));
    return json({ ok: true, mime: 'audio/wav', audio_base64: btoa(bin), voice });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
