import { supabase } from '../integrations/supabase/client';
import { persistImageSource } from './imageSources';
import type { TemplateSchema } from '../types/templateSchema';
import type { Json } from '../integrations/supabase/types';

export type ManualTemplateSave = {
  templateId: string;
  referenceImage?: string;      // preview_url (optional replacement)
  cleanBackground: string;      // clean_background_url
  schema: TemplateSchema;       // template_schema
  compiledHtml: string;         // generated_html (must be fillTemplateHtml-compatible)
};

/**
 * Saves a manual template onto the SAME templates row in a single UPDATE.
 * Images are persisted to Storage first; if anything fails before the update,
 * the previous configuration stays untouched. Only a successful update marks it 'manual'.
 */
export async function saveManualTemplate(input: ManualTemplateSave) {
  if (!input.compiledHtml.trim()) throw new Error('HTML compilado vazio.');
  if (input.schema?.version !== 1) throw new Error('Versão de schema não suportada.');
  const clean = await persistImageSource(input.cleanBackground, 'template');
  const preview = input.referenceImage ? await persistImageSource(input.referenceImage, 'template') : undefined;
  const payload = {
    clean_background_url: clean,
    template_schema: input.schema as unknown as Json,
    generated_html: input.compiledHtml,
    creation_type: 'manual',
    updated_at: new Date().toISOString(),
    ...(preview ? { preview_url: preview } : {}),
  };
  const { data, error } = await supabase.from('templates').update(payload).eq('id', input.templateId).select('id').single();
  if (error) throw error;
  return data;
}
