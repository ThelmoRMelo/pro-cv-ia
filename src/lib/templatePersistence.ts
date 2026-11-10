import { supabase } from '../integrations/supabase/client';
import { classifyImageSource, persistImageSource, storageLocation } from './imageSources';
import { compileTemplate, validateSchema } from './templateCompiler';
import type { TemplateSchema } from '../types/templateSchema';
import type { Json } from '../integrations/supabase/types';

export type ManualTemplateSave = {
  templateId: string;
  referenceImage?: string;      // preview_url (only when the admin explicitly replaces it)
  cleanBackground: string;      // clean_background_url
  schema: TemplateSchema;       // template_schema
};

async function removeUploaded(urls: string[]) {
  const byBucket = new Map<string, string[]>();
  for (const url of urls) { const loc = storageLocation(url, 'template'); if (loc) byBucket.set(loc.bucket, [...(byBucket.get(loc.bucket) || []), loc.path]); }
  await Promise.all([...byBucket].map(([bucket, paths]) => supabase.storage.from(bucket).remove(paths).catch(() => null)));
}

/**
 * Saves a manual template onto the SAME templates row in a single UPDATE.
 * 1. validates the schema; 2. uploads new images; 3. compiles the HTML with the stored URL;
 * 4. one UPDATE sets every manual column. Files uploaded in this attempt are removed if a later step fails,
 * and the previously saved configuration is left untouched.
 */
export async function saveManualTemplate(input: ManualTemplateSave) {
  const invalid = validateSchema(input.schema);
  if (invalid) throw new Error(invalid);
  if (!input.cleanBackground) throw new Error('Envie a imagem de fundo limpa (imagem 2).');
  const uploaded: string[] = [];
  try {
    const clean = await persistImageSource(input.cleanBackground, 'template');
    if (classifyImageSource(input.cleanBackground) === 'data') uploaded.push(clean);
    let preview: string | undefined;
    if (input.referenceImage) {
      preview = await persistImageSource(input.referenceImage, 'template');
      if (classifyImageSource(input.referenceImage) === 'data') uploaded.push(preview);
    }
    const html = compileTemplate(input.schema, clean);
    const payload = {
      clean_background_url: clean,
      template_schema: input.schema as unknown as Json,
      generated_html: html,
      creation_type: 'manual',
      updated_at: new Date().toISOString(),
      ...(preview ? { preview_url: preview } : {}),
    };
    const { data, error } = await supabase.from('templates').update(payload).eq('id', input.templateId).select('id').maybeSingle();
    if (error) throw new Error(error.message || 'Falha ao gravar o modelo.');
    if (!data) throw new Error('Modelo não encontrado ou sem permissão para salvar.');
    return { id: data.id, generated_html: html, clean_background_url: clean, preview_url: preview };
  } catch (error) {
    if (uploaded.length) await removeUploaded(uploaded);
    throw error;
  }
}
