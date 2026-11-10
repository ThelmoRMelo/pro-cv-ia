// Versioned contract for manual templates (stored in templates.template_schema).
// Coordinates are NORMALIZED (0..1) relative to the A4 page, so the layout is
// independent from the editor zoom and from the preview/PDF scale.

export type TemplateCreationType = 'ai' | 'manual' | null;

/** Candidate fields that really exist in the candidate form (App.tsx / ResumePreviewCandidate). */
export const CANDIDATE_FIELDS = [
  { key: 'name', label: 'Nome completo', token: 'name', group: 'Dados básicos', sample: 'Ana Beatriz Souza', long: false },
  { key: 'role', label: 'Área ou cargo desejado', token: 'role', group: 'Dados básicos', sample: 'Analista Financeira', long: false },
  { key: 'email', label: 'E-mail', token: 'email', group: 'Contato', sample: 'ana.souza@email.com', long: false },
  { key: 'phone', label: 'Telefone / WhatsApp', token: 'phone', group: 'Contato', sample: '(85) 98888-7777', long: false },
  { key: 'city', label: 'Cidade e estado', token: 'city', group: 'Contato', sample: 'Fortaleza, CE', long: false },
  { key: 'linkedin', label: 'LinkedIn', token: 'linkedin', group: 'Contato', sample: 'linkedin.com/in/anasouza', long: false },
  { key: 'portfolio', label: 'Portfólio ou site', token: 'portfolio', group: 'Contato', sample: 'anasouza.com.br', long: false },
  { key: 'birthDate', label: 'Data de nascimento', token: 'birthDate', group: 'Informações pessoais', sample: '1994-05-12', long: false },
  { key: 'maritalStatus', label: 'Estado civil', token: 'maritalStatus', group: 'Informações pessoais', sample: 'Solteiro(a)', long: false },
  { key: 'nationality', label: 'Nacionalidade', token: 'nationality', group: 'Informações pessoais', sample: 'Brasileira', long: false },
  { key: 'driverLicense', label: 'CNH', token: 'driverLicense', group: 'Informações pessoais', sample: 'B', long: false },
  { key: 'summary', label: 'Resumo profissional', token: 'summary', group: 'Seções', sample: 'Profissional com 6 anos de experiência em controladoria, conciliações e análise de indicadores financeiros.', long: true },
  { key: 'experience', label: 'Experiências profissionais', token: 'experience', group: 'Seções', sample: 'Empresa Alfa • Analista Financeira • 2020–atual\nConciliações bancárias e relatórios gerenciais.\n\nEmpresa Beta • Assistente Financeira • 2017–2020\nContas a pagar e receber.', long: true },
  { key: 'education', label: 'Formação e cursos', token: 'education', group: 'Seções', sample: 'Ciências Contábeis • UFC • 2018\nExcel Avançado • SENAC • 2021', long: true },
  { key: 'skills', label: 'Competências e idiomas', token: 'skills', group: 'Seções', sample: 'Excel, Power BI, SAP, atendimento, inglês intermediário', long: true },
] as const;

export type CandidateFieldKey = typeof CANDIDATE_FIELDS[number]['key'];

export type Box = { x: number; y: number; w: number; h: number; rotation: number; skewX?: number };

export type TextStyle = {
  fontFamily: string; fontSize: number; fontWeight: number; fontStyle: 'normal' | 'italic';
  color: string; textAlign: 'left' | 'center' | 'right' | 'justify'; lineHeight: number;
  letterSpacing: number; textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  padding: number;
};

/** grow: area expands downward when content is longer. fixed: area keeps size; overflow is reported, never hidden. */
export type OverflowRule = { mode: 'grow' | 'fixed'; minFontSize: number; maxFontSize: number };

type Base = { id: string; box: Box; hidden?: boolean; locked?: boolean };
export type FieldElement = Base & { kind: 'field'; field: CandidateFieldKey; style: TextStyle; overflow: OverflowRule; prefix?: string };
export type TextElement = Base & { kind: 'text'; content: string; style: TextStyle };
export type IconElement = Base & { kind: 'icon'; icon: string; color: string; strokeWidth: number };
export type ShapeElement = Base & { kind: 'shape'; shape: 'rect' | 'ellipse' | 'line' | 'triangle' | 'diamond'; fill: string; stroke: string; strokeWidth: number; radius: number; opacity: number };
export type PhotoElement = Base & {
  kind: 'photo';
  frame: { shape: 'circle' | 'square' | 'horizontal' | 'vertical' | 'rounded' | 'custom'; radius: number; borderWidth: number; borderColor: string };
  /** Image transform INSIDE the frame (independent from box.rotation, which rotates the frame). */
  image: { zoom: number; posX: number; posY: number; rotation: number };
};
export type TemplateElement = FieldElement | TextElement | IconElement | ShapeElement | PhotoElement;

export type TemplateSchemaV2 = {
  version: 2;
  page: { width: 794; height: 1123 };
  /** Alignment of the clean background (image 2) inside the A4 page. Its URL lives in templates.clean_background_url. */
  background: { fit: 'stretch' | 'cover' | 'contain'; offsetX: number; offsetY: number; scale: number };
  /** Elements in layer order: first = bottom, last = top. */
  elements: TemplateElement[];
};
export type TemplateSchema = TemplateSchemaV2;

export const PAGE_W = 794;
export const PAGE_H = 1123;

export function emptySchema(): TemplateSchemaV2 {
  return { version: 2, page: { width: 794, height: 1123 }, background: { fit: 'stretch', offsetX: 0, offsetY: 0, scale: 1 }, elements: [] };
}

/** Loads a persisted schema; unknown/old versions return null so the editor starts fresh instead of corrupting data. */
export function parseSchema(raw: unknown): TemplateSchemaV2 | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<TemplateSchemaV2>;
  if (s.version !== 2 || !Array.isArray(s.elements)) return null;
  return { ...emptySchema(), ...s, background: { ...emptySchema().background, ...(s.background || {}) } } as TemplateSchemaV2;
}

/** Configuration state derived only from persisted, successful results. */
export function templateConfigState(t: { creation_type?: string | null; generated_html?: string | null }) {
  const hasHtml = Boolean(t.generated_html?.trim());
  if (t.creation_type === 'manual' && hasHtml) return { configured: true, method: 'manual' as const, aiAvailable: false, manualAvailable: true };
  if (t.creation_type === 'ai' && hasHtml) return { configured: true, method: 'ai' as const, aiAvailable: false, manualAvailable: false };
  // Legacy rows with HTML but no creation_type are AI output from before Stage 1.
  if (!t.creation_type && hasHtml) return { configured: true, method: 'ai' as const, aiAvailable: false, manualAvailable: false };
  return { configured: false, method: null, aiAvailable: true, manualAvailable: true };
}
