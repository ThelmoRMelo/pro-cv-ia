import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Panel-saved key wins (admin-controlled, survives remixes); env secret is the fallback. */
export async function resolveGeminiKey(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin.from('ai_settings').select('gemini_api_key').eq('id', 'default').maybeSingle();
  const fromDb = (data?.gemini_api_key ?? '').trim();
  if (fromDb) return fromDb;
  return Deno.env.get('Gemini_API_Key') || Deno.env.get('GEMINI_API_KEY') || null;
}
