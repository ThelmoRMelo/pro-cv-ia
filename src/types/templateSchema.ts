// Versioned contract for manual templates (stored in templates.template_schema).
// Version 1 is a proposal; the visual editor (next stage) may extend it by bumping `version`.

export type TemplateCreationType = 'ai' | 'manual' | null;

export type CandidateField =
  | 'nome' | 'profissao' | 'email' | 'telefone' | 'endereco' | 'objetivo'
  | 'experiencias' | 'educacao' | 'competencias' | 'linkedin' | 'portfolio' | 'foto';

export type ElementBox = { x: number; y: number; width: number; height: number; rotation?: number; zIndex: number };

export type TextStyle = {
  fontFamily: string; fontSize: number; fontWeight?: number; fontStyle?: 'normal' | 'italic';
  color: string; textAlign?: 'left' | 'center' | 'right' | 'justify'; lineHeight?: number;
  letterSpacing?: number; textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
};

export type TextBehavior = { overflow: 'clip' | 'shrink' | 'grow'; maxLines?: number; minFontSize?: number };

export type TemplateElement =
  | { id: string; type: 'field'; field: Exclude<CandidateField, 'foto'>; box: ElementBox; style: TextStyle; behavior?: TextBehavior }
  | { id: string; type: 'text'; content: string; box: ElementBox; style: TextStyle }
  | { id: string; type: 'icon'; icon: string; box: ElementBox; color: string; strokeWidth?: number }
  | { id: string; type: 'shape'; shape: 'rect' | 'ellipse' | 'line'; box: ElementBox; fill?: string; stroke?: string; strokeWidth?: number; radius?: number }
  | {
      id: string; type: 'photo'; box: ElementBox;
      frame?: { shape: 'rect' | 'rounded' | 'circle'; radius?: number; borderWidth?: number; borderColor?: string };
      crop?: { zoom: number; offsetX: number; offsetY: number; objectPositionX?: number; objectPositionY?: number };
    };

export type TemplateSchemaV1 = {
  version: 1;
  page: { width: 794; height: 1123; background?: string };
  elements: TemplateElement[];
};

export type TemplateSchema = TemplateSchemaV1;

/** Configuration state derived only from persisted, successful results. */
export function templateConfigState(t: { creation_type?: TemplateCreationType; generated_html?: string | null }) {
  const hasHtml = Boolean(t.generated_html?.trim());
  if (t.creation_type === 'manual' && hasHtml) return { configured: true, method: 'manual' as const, aiAvailable: false, manualAvailable: true };
  if (t.creation_type === 'ai' && hasHtml) return { configured: true, method: 'ai' as const, aiAvailable: false, manualAvailable: false };
  return { configured: false, method: null, aiAvailable: true, manualAvailable: true };
}
