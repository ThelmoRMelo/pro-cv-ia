import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SYSTEM_PROMPT = `Você é um especialista em clonagem pixel-perfect de currículos em HTML/CSS.
Sua tarefa: reproduzir FIELMENTE o design da imagem enviada — é uma CÓPIA, não uma inspiração.
Copie exatamente: número e largura proporcional das colunas, faixas/barras laterais, cores (use os hexadecimais observados), fundo, tipografia (peso, tamanho relativo, caixa alta, espaçamento entre letras), hierarquia, ordem das seções, ícones (desenhe com CSS/SVG inline ou caracteres unicode), linhas divisórias, bordas, cantos, espaçamentos e posição/formato da foto (circular, quadrada, com borda etc.).
Regras obrigatórias:
- Página A4: um container raiz com width:794px; min-height:1123px; box-sizing:border-box; overflow:hidden; margin:0 auto; background:#ffffff;
- HTML autossuficiente: todo CSS em uma tag <style>; NENHUM JavaScript, NENHUMA fonte, imagem ou CSS externo. Use fontes de sistema próximas (Arial, Helvetica, Georgia, 'Times New Roman', Verdana).
- NÃO mantenha nenhum dado pessoal da imagem. Substitua por placeholders exatos:
  {{nome}}, {{profissao}}, {{email}}, {{telefone}}, {{endereco}}, {{objetivo}}, {{experiencias}}, {{educacao}}, {{competencias}}, {{linkedin}}, {{portfolio}}, {{foto}}.
- {{foto}} deve ser usado como valor do src: <img src="{{foto}}" ...> no mesmo local e formato da foto original.
- {{experiencias}}, {{educacao}} e {{competencias}} são blocos HTML que serão injetados; coloque cada um dentro do container da seção correspondente, mantendo títulos de seção como no original.
- Títulos de seção (ex.: "Experiência", "Formação") podem ser mantidos como texto fixo.
Responda APENAS com o HTML completo, sem markdown nem explicações.`;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

async function extractImageData(imageUrl: string): Promise<{ mimeType: string; data: string }> {
  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) throw new Error('Data URL de imagem inválida.');
    return { mimeType: match[1], data: match[2].trim() };
  }

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Falha ao baixar imagem de referência (${res.status}).`);
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  const data = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
  return { mimeType, data };
}

async function generateHtmlWithGeminiDirect(apiKey: string, mimeType: string, base64Data: string): Promise<string> {
  // [modelo, tempo máximo em ms] — soma abaixo do limite de ~150s da função
  const models: [string, number][] = [['gemini-3.8-flash', 60000], ['gemini-flash-latest', 45000], ['gemini-flash-lite-latest', 35000]];
  let lastError = '';

  for (const [model, timeoutMs] of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const t0 = Date.now();
    let res: Response;
    try { res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            parts: [
              { text: 'Clone fielmente este currículo em HTML/CSS A4 com os placeholders solicitados.' },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 32768,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    }); } catch (err) {
      console.error(`Gemini ${model} falhou após ${Date.now() - t0}ms:`, String(err));
      lastError = String(err);
      continue;
    }

    if (res.status === 429 && model === models[models.length - 1][0]) {
      throw new Error('Limite de requisições da sua chave do Gemini atingido temporariamente. Tente novamente em alguns segundos.');
    }

    console.log(`Gemini ${model} status ${res.status} em ${Date.now() - t0}ms`);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Erro Gemini API (${model}):`, res.status, errText);
      lastError = errText;
      continue;
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText) {
      return candidateText;
    }
  }

  throw new Error(`Falha ao obter resposta dos modelos Gemini: ${lastError}`);
}

async function generateHtmlWithGateway(apiKey: string, imageUrl: string): Promise<string> {
  const ai = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Clone fielmente este currículo em HTML/CSS A4 com os placeholders.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (ai.status === 429) throw new Error('Muitas solicitações à IA. Tente em instantes.');
  if (ai.status === 402) throw new Error('Créditos de IA esgotados.');
  if (!ai.ok) {
    console.error('AI error', ai.status, await ai.text());
    throw new Error('Falha no processamento da IA.');
  }

  const out = await ai.json();
  return out?.choices?.[0]?.message?.content ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Não autenticado.' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });

    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(auth.replace('Bearer ', ''));
    if (claimsErr || !claims?.claims?.sub) return json({ error: 'Sessão inválida.' }, 401);

    const { data: isAdmin } = await userClient.rpc('has_role', { _user_id: claims.claims.sub, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Acesso restrito ao administrador.' }, 403);

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.template_id === 'string' ? body.template_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'template_id inválido.' }, 400);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: tpl } = await admin
      .from('templates')
      .select('id, preview_url, reference_file_url')
      .eq('id', id)
      .maybeSingle();

    if (!tpl) return json({ error: 'Modelo não encontrado.' }, 404);
    const imageUrl = tpl.reference_file_url || tpl.preview_url;
    if (!imageUrl) return json({ error: 'Modelo sem imagem de referência.' }, 400);

    const geminiKey = Deno.env.get('Gemini_API_Key') || Deno.env.get('GEMINI_API_KEY');
    const gatewayKey = Deno.env.get('LOVABLE_API_KEY');

    let rawOutput = '';

    if (geminiKey) {
      const { mimeType, data: base64Data } = await extractImageData(imageUrl);
      rawOutput = await generateHtmlWithGeminiDirect(geminiKey, mimeType, base64Data);
    } else if (gatewayKey) {
      rawOutput = await generateHtmlWithGateway(gatewayKey, imageUrl);
    } else {
      return json({ error: 'Nenhuma chave de IA configurada (cadastre Gemini_API_Key nos segredos).' }, 500);
    }

    let html = rawOutput.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim();
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');
    html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

    if (!html.includes('{{nome}}')) {
      return json({ error: 'A IA não retornou um HTML válido com os placeholders. Tente novamente.' }, 502);
    }

    const { error: upErr } = await admin
      .from('templates')
      .update({ generated_html: html, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (upErr) return json({ error: 'Não foi possível salvar o HTML gerado.' }, 500);

    return json({ generated_html: html });
  } catch (e: any) {
    console.error('Edge function error:', e);
    return json({ error: e?.message || 'Erro inesperado no processamento.' }, 500);
  }
});
