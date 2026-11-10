import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { icons } from 'lucide-react';
import { PAGE_H, PAGE_W, type PhotoElement, type ShapeElement, type TemplateElement, type TemplateSchemaV2, type TextStyle } from '../types/templateSchema';

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const px = (n: number) => `${Math.round(n * 100) / 100}px`;
const safeColor = (c: string) => (/^#[0-9a-f]{3,8}$|^rgba?\([\d\s.,%]+\)$|^transparent$/i.test(c) ? c : '#000000');
const safeFont = (f: string) => f.replace(/[^a-zA-Z0-9 ,'-]/g, '');

export function iconSvg(name: string, color: string, strokeWidth: number) {
  const Icon = (icons as Record<string, any>)[name];
  if (!Icon) return '';
  return renderToStaticMarkup(createElement(Icon, { color: safeColor(color), strokeWidth, width: '100%', height: '100%', absoluteStrokeWidth: false }));
}

function boxCss(el: TemplateElement, z: number, extra = '') {
  const b = el.box;
  const transform = [b.rotation ? `rotate(${b.rotation}deg)` : '', b.skewX ? `skewX(${b.skewX}deg)` : ''].filter(Boolean).join(' ');
  return `position:absolute;left:${px(b.x * PAGE_W)};top:${px(b.y * PAGE_H)};width:${px(b.w * PAGE_W)};z-index:${z + 2};${transform ? `transform:${transform};transform-origin:center;` : ''}${extra}`;
}

/** Font size uses a CSS variable so a future global candidate-side scale can be applied without recompiling. */
function textCss(s: TextStyle) {
  return `font-family:${safeFont(s.fontFamily)};font-size:calc(${px(s.fontSize)} * var(--cv-font-scale,1));font-weight:${s.fontWeight};font-style:${s.fontStyle};color:${safeColor(s.color)};text-align:${s.textAlign};line-height:${s.lineHeight};letter-spacing:${px(s.letterSpacing)};text-transform:${s.textTransform};padding:${px(s.padding)};box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;word-break:break-word;`;
}

function shapeHtml(el: ShapeElement, z: number) {
  const h = el.box.h * PAGE_H, w = el.box.w * PAGE_W;
  const common = `opacity:${el.opacity};`;
  if (el.shape === 'line') return `<div style="${boxCss(el, z, `height:${px(h)};${common}`)}"><div style="position:absolute;left:0;right:0;top:50%;height:${px(Math.max(1, el.strokeWidth))};transform:translateY(-50%);background:${safeColor(el.stroke)}"></div></div>`;
  if (el.shape === 'triangle' || el.shape === 'diamond') {
    const pts = el.shape === 'triangle' ? `${w / 2},0 ${w},${h} 0,${h}` : `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
    return `<div style="${boxCss(el, z, `height:${px(h)};${common}`)}"><svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polygon points="${pts}" fill="${safeColor(el.fill)}" stroke="${safeColor(el.stroke)}" stroke-width="${el.strokeWidth}"/></svg></div>`;
  }
  const radius = el.shape === 'ellipse' ? '50%' : px(el.radius);
  return `<div style="${boxCss(el, z, `height:${px(h)};background:${safeColor(el.fill)};border:${px(el.strokeWidth)} solid ${safeColor(el.stroke)};border-radius:${radius};box-sizing:border-box;${common}`)}"></div>`;
}

export function photoRadius(el: PhotoElement) {
  return el.frame.shape === 'circle' ? '50%' : el.frame.shape === 'rounded' || el.frame.shape === 'custom' ? px(el.frame.radius) : '0';
}

function photoHtml(el: PhotoElement, z: number) {
  const h = el.box.h * PAGE_H;
  const img = el.image;
  // background-size:cover keeps the photo proportions (never stretched); zoom/position/rotation only reframe it.
  return `<div data-cv-photo style="${boxCss(el, z, `height:${px(h)};overflow:hidden;border-radius:${photoRadius(el)};border:${px(el.frame.borderWidth)} solid ${safeColor(el.frame.borderColor)};box-sizing:border-box;`)}"><div style="position:absolute;inset:0;background-image:url('{{photo}}');background-size:cover;background-repeat:no-repeat;background-position:${img.posX}% ${img.posY}%;transform:scale(${img.zoom}) rotate(${img.rotation}deg);transform-origin:${img.posX}% ${img.posY}%"></div></div>`;
}

function elementHtml(el: TemplateElement, z: number): string {
  if (el.hidden) return '';
  const h = el.box.h * PAGE_H;
  switch (el.kind) {
    case 'field': {
      const sizing = el.overflow.mode === 'grow' ? `min-height:${px(h)};` : `height:${px(h)};overflow:visible;`;
      const prefix = el.prefix ? `${esc(el.prefix)}` : '';
      return `<div data-cv-field="${el.field}" data-cv-max-h="${Math.round(h)}" data-cv-mode="${el.overflow.mode}" style="${boxCss(el, z, sizing + textCss(el.style))}">${prefix}{{${el.field}}}</div>`;
    }
    case 'text':
      return `<div style="${boxCss(el, z, `height:${px(h)};` + textCss(el.style))}">${esc(el.content).replace(/\n/g, '<br>')}</div>`;
    case 'icon':
      return `<div style="${boxCss(el, z, `height:${px(h)};display:flex;`)}">${iconSvg(el.icon, el.color, el.strokeWidth)}</div>`;
    case 'shape':
      return shapeHtml(el, z);
    case 'photo':
      return photoHtml(el, z);
  }
}

export function backgroundCss(schema: TemplateSchemaV2) {
  const bg = schema.background;
  const fit = bg.fit === 'stretch' ? 'fill' : bg.fit;
  return `position:absolute;left:0;top:0;width:${PAGE_W}px;height:${PAGE_H}px;object-fit:${fit};transform:translate(${px(bg.offsetX * PAGE_W)},${px(bg.offsetY * PAGE_H)}) scale(${bg.scale});transform-origin:center;z-index:1;`;
}

/**
 * Compiles a manual schema into a self-contained A4 HTML document (794x1123) with inline styles only.
 * Output uses the same {{placeholder}} contract consumed by fillTemplateHtml(), so preview (iframe)
 * and PDF (innerHTML + html2canvas) keep using the existing single rendering path.
 */
export function compileTemplate(schema: TemplateSchemaV2, cleanBackgroundUrl: string, opts: { allowInline?: boolean } = {}): string {
  if (!cleanBackgroundUrl) throw new Error('Envie a imagem de fundo limpa antes de salvar.');
  if (!opts.allowInline && /^(data|blob):/i.test(cleanBackgroundUrl)) throw new Error('O fundo precisa estar salvo no armazenamento antes da compilação.');
  const body = schema.elements.map((el, i) => elementHtml(el, i)).join('');
  return `<div class="cv-manual-page" style="--cv-font-scale:1;position:relative;width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;background:#ffffff;margin:0 auto;font-family:Arial,Helvetica,sans-serif"><img src="${esc(cleanBackgroundUrl)}" alt="" crossorigin="anonymous" style="${backgroundCss(schema)}"/>${body}</div>`;
}

/** Measures rendered fields and reports those exceeding the configured area (used by the editor and the candidate preview). */
export function findOverflowingFields(root: ParentNode): string[] {
  const out: string[] = [];
  root.querySelectorAll<HTMLElement>('[data-cv-field]').forEach(node => {
    const max = Number(node.dataset.cvMaxH || 0);
    if (node.dataset.cvMode === 'fixed' && node.scrollHeight > max + 2) out.push(node.dataset.cvField || '');
    if (node.dataset.cvMode === 'grow') {
      const page = node.closest('.cv-manual-page') as HTMLElement | null;
      if (page && node.offsetTop + node.scrollHeight > page.clientHeight + 2) out.push(node.dataset.cvField || '');
    }
  });
  return out;
}

/** Validates the schema before saving. */
export function validateSchema(schema: TemplateSchemaV2): string | null {
  if (schema.version !== 2) return 'Versão de modelo não suportada.';
  if (!schema.elements.length) return 'Adicione ao menos um campo ao modelo antes de salvar.';
  for (const el of schema.elements) {
    const b = el.box;
    if (![b.x, b.y, b.w, b.h].every(Number.isFinite) || b.w <= 0 || b.h <= 0) return 'Há elementos com dimensões inválidas.';
    if (el.kind === 'field' && el.overflow.minFontSize > el.overflow.maxFontSize) return 'Fonte mínima maior que a máxima em um campo.';
  }
  return null;
}
