import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Circle, Copy, Eye, Image as ImageIcon, Layers, Minus, Redo2, Save, Square, Trash2, Triangle, Type, Undo2, X, ZoomIn, ZoomOut, Diamond, FlaskConical, PanelLeft, SlidersHorizontal } from 'lucide-react';
import { icons } from 'lucide-react';
import { resolveImageSource } from './lib/imageSources';
import { backgroundCss, compileTemplate, findOverflowingFields, iconSvg, photoRadius } from './lib/templateCompiler';
import { saveManualTemplate } from './lib/templatePersistence';
import { fillTemplateHtml } from './CandidateResumePreview';
import { CANDIDATE_FIELDS, PAGE_H, PAGE_W, emptySchema, parseSchema, type Box, type CandidateFieldKey, type TemplateElement, type TemplateSchemaV2, type TextStyle } from './types/templateSchema';

export type EditorTemplate = { id:string; name:string; preview_url?:string; clean_background_url?:string|null; template_schema?:unknown; creation_type?:string|null };
type Props = { template:EditorTemplate; onClose:()=>void; onSaved:(r:{id:string;generated_html:string;clean_background_url:string;template_schema:TemplateSchemaV2})=>void; notify:(m:string)=>void };

const RESUME_ICONS = ['Phone','Smartphone','Mail','MapPin','House','Briefcase','GraduationCap','Target','BookOpen','Award','Star','Languages','Globe','Linkedin','User','Calendar','Car','Heart','Lightbulb','Wrench','Code','Laptop','Flag','CircleCheck','MessageCircle','Building2','Trophy','Users','Clock','Link'].filter(n=>n in icons);
const FONTS = ['Arial, Helvetica, sans-serif','Georgia, serif','Times New Roman, serif','Verdana, sans-serif','Trebuchet MS, sans-serif','Courier New, monospace','DM Sans, sans-serif','Playfair Display, serif'];
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const baseText = (over:Partial<TextStyle>={}):TextStyle=>({fontFamily:FONTS[0],fontSize:13,fontWeight:400,fontStyle:'normal',color:'#222222',textAlign:'left',lineHeight:1.35,letterSpacing:0,textTransform:'none',padding:2,...over});
const SAMPLE_PHOTO = 'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#c9d6cf"/><circle cx="150" cy="150" r="70" fill="#8aa197"/><ellipse cx="150" cy="360" rx="120" ry="110" fill="#8aa197"/></svg>');
const sampleCandidate = (long:boolean) => { const c:Record<string,string>={}; for(const f of CANDIDATE_FIELDS)c[f.key]=long&&f.long?`${f.sample}\n${f.sample}\n${f.sample}\n${f.sample}`:f.sample; return {...c,photoUrl:SAMPLE_PHOTO} as any; };

function newElement(kind:string, extra:string|undefined, at?:{x:number;y:number}):TemplateElement {
  const box=(w:number,h:number):Box=>({x:clamp((at?.x??.5)-w/2,0,1-w),y:clamp((at?.y??.4)-h/2,0,1-h),w,h,rotation:0});
  if(kind==='field'){const f=CANDIDATE_FIELDS.find(x=>x.key===extra)!;const isName=f.key==='name';return {id:uid(),kind:'field',field:f.key as CandidateFieldKey,box:f.long?box(.42,.14):box(isName?.5:.3,isName?.05:.025),style:baseText(isName?{fontSize:28,fontWeight:700}:f.key==='role'?{fontSize:16}:{}),overflow:{mode:f.long?'grow':'fixed',minFontSize:9,maxFontSize:isName?28:13}}}
  if(kind==='text')return {id:uid(),kind:'text',content:'Título da seção',box:box(.3,.03),style:baseText({fontSize:15,fontWeight:700,textTransform:'uppercase'})};
  if(kind==='icon')return {id:uid(),kind:'icon',icon:extra||'Phone',color:'#244b3e',strokeWidth:2,box:box(.025,.0177)};
  if(kind==='photo')return {id:uid(),kind:'photo',box:box(.2,.1414),frame:{shape:'circle',radius:12,borderWidth:0,borderColor:'#ffffff'},image:{zoom:1,posX:50,posY:30,rotation:0}};
  const shape=(extra||'rect') as any;
  return {id:uid(),kind:'shape',shape,fill:shape==='line'?'transparent':'#244b3e',stroke:shape==='line'?'#244b3e':'transparent',strokeWidth:shape==='line'?2:0,radius:0,opacity:1,box:shape==='line'?box(.4,.01):box(.15,.1)};
}

function useResolved(source?:string|null){
  const [url,setUrl]=useState('');
  useEffect(()=>{if(!source){setUrl('');return}let alive=true;let revoke:(()=>void)|undefined;resolveImageSource(source,'template').then(r=>{if(alive){setUrl(r.url);revoke=r.revoke}else r.revoke?.()}).catch(()=>alive&&setUrl(''));return()=>{alive=false;revoke?.()}},[source]);
  return url;
}
function useNatural(url:string){const [r,setR]=useState<number|null>(null);useEffect(()=>{if(!url){setR(null);return}const i=new Image();i.onload=()=>setR(i.naturalWidth/i.naturalHeight);i.src=url},[url]);return r}

async function readImage(file:File):Promise<string>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
  const image=await createImageBitmap(file,{imageOrientation:'from-image'});
  try{const scale=Math.min(1,1800/Math.max(image.width,image.height));const c=document.createElement('canvas');c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);const ctx=c.getContext('2d',{alpha:false})!;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9)}finally{image.close()}
}

function ElementView({el}:{el:TemplateElement}){
  const h=el.box.h*PAGE_H;
  if(el.kind==='field'||el.kind==='text'){const s=el.style;const text=el.kind==='field'?(el.prefix||'')+(CANDIDATE_FIELDS.find(f=>f.key===el.field)?.sample||''):el.content;
    return <div style={{fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,fontStyle:s.fontStyle,color:s.color,textAlign:s.textAlign,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,textTransform:s.textTransform,padding:s.padding,whiteSpace:'pre-wrap',overflowWrap:'anywhere',width:'100%',height:'100%',overflow:'hidden'}}>{text}</div>}
  if(el.kind==='icon')return <div style={{width:'100%',height:'100%',display:'flex'}} dangerouslySetInnerHTML={{__html:iconSvg(el.icon,el.color,el.strokeWidth)}}/>;
  if(el.kind==='photo')return <div style={{width:'100%',height:'100%',overflow:'hidden',borderRadius:photoRadius(el),border:`${el.frame.borderWidth}px solid ${el.frame.borderColor}`,boxSizing:'border-box',position:'relative'}}><div style={{position:'absolute',inset:0,backgroundImage:`url("${SAMPLE_PHOTO}")`,backgroundSize:'cover',backgroundPosition:`${el.image.posX}% ${el.image.posY}%`,transform:`scale(${el.image.zoom}) rotate(${el.image.rotation}deg)`,transformOrigin:`${el.image.posX}% ${el.image.posY}%`}}/></div>;
  const w=el.box.w*PAGE_W;
  if(el.shape==='line')return <div style={{position:'absolute',left:0,right:0,top:'50%',height:Math.max(1,el.strokeWidth),background:el.stroke,opacity:el.opacity,transform:'translateY(-50%)'}}/>;
  if(el.shape==='triangle'||el.shape==='diamond'){const pts=el.shape==='triangle'?`${w/2},0 ${w},${h} 0,${h}`:`${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`;return <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{opacity:el.opacity}}><polygon points={pts} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}/></svg>}
  return <div style={{width:'100%',height:'100%',background:el.fill,border:`${el.strokeWidth}px solid ${el.stroke}`,borderRadius:el.shape==='ellipse'?'50%':el.radius,boxSizing:'border-box',opacity:el.opacity}}/>;
}

const HANDLES=['nw','n','ne','e','se','s','sw','w'] as const;

export default function ManualTemplateEditor({template,onClose,onSaved,notify}:Props){
  const initial=useMemo(()=>parseSchema(template.template_schema)||emptySchema(),[template]);
  const [schema,setSchema]=useState<TemplateSchemaV2>(initial);
  const [past,setPast]=useState<TemplateSchemaV2[]>([]);const [future,setFuture]=useState<TemplateSchemaV2[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [cleanBg,setCleanBg]=useState<string>(template.clean_background_url||'');
  const [zoom,setZoom]=useState(.7);
  const [refOpacity,setRefOpacity]=useState(template.clean_background_url?0:.55);
  const [showClean,setShowClean]=useState(true);
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [test,setTest]=useState<{html:string;long:boolean;overflow:string[]}|null>(null);
  const [iconQuery,setIconQuery]=useState('');
  const [mobilePanel,setMobilePanel]=useState<'none'|'library'|'props'>('none');
  const pageRef=useRef<HTMLDivElement>(null);
  const testRef=useRef<HTMLDivElement>(null);
  const refUrl=useResolved(template.preview_url);const cleanUrl=useResolved(cleanBg);
  const refRatio=useNatural(refUrl),cleanRatio=useNatural(cleanUrl);
  const ratioMismatch=refRatio&&cleanRatio?Math.abs(refRatio-cleanRatio)/refRatio>.02:false;
  const a4Mismatch=cleanRatio?Math.abs(cleanRatio-PAGE_W/PAGE_H)/(PAGE_W/PAGE_H)>.02:false;
  const selected=schema.elements.find(e=>e.id===selectedId)||null;

  const commit=useCallback((next:TemplateSchemaV2)=>{setPast(p=>[...p.slice(-80),schema]);setFuture([]);setSchema(next);setDirty(true)},[schema]);
  const updateEl=(id:string,patch:(e:any)=>any,record=true)=>{const next={...schema,elements:schema.elements.map(e=>e.id===id?patch(e):e)};record?commit(next):setSchema(next)};
  const undo=()=>{if(!past.length)return;setFuture(f=>[schema,...f]);setSchema(past[past.length-1]);setPast(p=>p.slice(0,-1));setDirty(true)};
  const redo=()=>{if(!future.length)return;setPast(p=>[...p,schema]);setSchema(future[0]);setFuture(f=>f.slice(1));setDirty(true)};
  const add=(kind:string,extra?:string,at?:{x:number;y:number})=>{const el=newElement(kind,extra,at);commit({...schema,elements:[...schema.elements,el]});setSelectedId(el.id);setMobilePanel('none')};
  const remove=()=>{if(!selected)return;commit({...schema,elements:schema.elements.filter(e=>e.id!==selected.id)});setSelectedId(null)};
  const duplicate=()=>{if(!selected)return;const copy={...structuredClone(selected),id:uid()};copy.box={...copy.box,x:clamp(copy.box.x+.02,0,1-copy.box.w),y:clamp(copy.box.y+.02,0,1-copy.box.h)};commit({...schema,elements:[...schema.elements,copy]});setSelectedId(copy.id)};
  const reorder=(dir:'up'|'down'|'top'|'bottom')=>{if(!selected)return;const list=schema.elements.filter(e=>e.id!==selected.id);const idx=schema.elements.findIndex(e=>e.id===selected.id);const to=dir==='top'?list.length:dir==='bottom'?0:dir==='up'?Math.min(list.length,idx+1):Math.max(0,idx-1);list.splice(to,0,selected);commit({...schema,elements:list})};

  // Pointer drag / resize (coordinates converted to normalized page units)
  const drag=useRef<{id:string;mode:string;sx:number;sy:number;box:Box;snap:TemplateSchemaV2}|null>(null);
  const startDrag=(e:React.PointerEvent,el:TemplateElement,mode:string)=>{if(el.locked)return;e.stopPropagation();e.preventDefault();setSelectedId(el.id);drag.current={id:el.id,mode,sx:e.clientX,sy:e.clientY,box:{...el.box},snap:schema}};
  useEffect(()=>{
    const move=(e:PointerEvent)=>{const d=drag.current;if(!d)return;const dx=(e.clientX-d.sx)/zoom/PAGE_W,dy=(e.clientY-d.sy)/zoom/PAGE_H;const b={...d.box};
      if(d.mode==='move'){b.x=clamp(b.x+dx,-b.w+.01,.99);b.y=clamp(b.y+dy,-b.h+.01,.99)}else{const m=d.mode;const min=.008;
        if(m.includes('e'))b.w=Math.max(min,d.box.w+dx);if(m.includes('s'))b.h=Math.max(min,d.box.h+dy);
        if(m.includes('w')){b.w=Math.max(min,d.box.w-dx);b.x=d.box.x+d.box.w-b.w}if(m.includes('n')){b.h=Math.max(min,d.box.h-dy);b.y=d.box.y+d.box.h-b.h}}
      setSchema(s=>({...s,elements:s.elements.map(x=>x.id===d.id?{...x,box:b}:x)}))};
    const up=()=>{const d=drag.current;if(!d)return;drag.current=null;setSchema(s=>{if(s!==d.snap){setPast(p=>[...p.slice(-80),d.snap]);setFuture([]);setDirty(true)}return s})};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};
  },[zoom]);

  useEffect(()=>{const key=(e:KeyboardEvent)=>{const t=e.target as HTMLElement;if(/INPUT|TEXTAREA|SELECT/.test(t.tagName))return;const mod=e.ctrlKey||e.metaKey;
    if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}else if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate()}
    else if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();remove()}
    else if(selected&&e.key.startsWith('Arrow')){e.preventDefault();const st=(e.shiftKey?10:1);const dx=e.key==='ArrowLeft'?-st:e.key==='ArrowRight'?st:0,dy=e.key==='ArrowUp'?-st:e.key==='ArrowDown'?st:0;updateEl(selected.id,x=>({...x,box:{...x.box,x:x.box.x+dx/PAGE_W,y:x.box.y+dy/PAGE_H}}))}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)});

  const onDrop=(e:React.DragEvent)=>{e.preventDefault();const data=e.dataTransfer.getData('text/cv-element');if(!data||!pageRef.current)return;const [kind,extra]=data.split(':');const r=pageRef.current.getBoundingClientRect();add(kind,extra||undefined,{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height})};
  const dragItem=(kind:string,extra='')=>({draggable:true,onDragStart:(e:React.DragEvent)=>e.dataTransfer.setData('text/cv-element',`${kind}:${extra}`),onClick:()=>add(kind,extra||undefined)});

  const runTest=(long:boolean)=>{if(!cleanUrl){notify('Envie a imagem de fundo limpa (imagem 2) para testar.');return}
    const html=fillTemplateHtml({id:'t',name:'t',color:'',layout:0,generated_html:compileTemplate(schema,cleanUrl,{allowInline:true})},sampleCandidate(long));setTest({html,long,overflow:[]})};
  useEffect(()=>{if(!test||!testRef.current)return;const id=requestAnimationFrame(()=>{const o=findOverflowingFields(testRef.current!);if(o.join()!==test.overflow.join())setTest(t=>t&&{...t,overflow:o})});return()=>cancelAnimationFrame(id)},[test]);

  const save=async()=>{if(!cleanBg){notify('Envie a imagem de fundo limpa (imagem 2) antes de salvar.');return}setSaving(true);
    try{const r=await saveManualTemplate({templateId:template.id,cleanBackground:cleanBg,schema});setCleanBg(r.clean_background_url);setDirty(false);onSaved({id:r.id,generated_html:r.generated_html,clean_background_url:r.clean_background_url,template_schema:schema});notify('Modelo manual salvo com sucesso!')}
    catch(error){notify(error instanceof Error?error.message:'Não foi possível salvar. A configuração anterior foi mantida.')}finally{setSaving(false)}};
  const close=()=>{if(dirty&&!window.confirm('Sair sem salvar? As alterações não salvas serão perdidas.'))return;onClose()};

  const iconList=iconQuery.trim()?Object.keys(icons).filter(n=>n.toLowerCase().includes(iconQuery.trim().toLowerCase())).slice(0,60):RESUME_ICONS;
  const groups=[...new Set(CANDIDATE_FIELDS.map(f=>f.group))];
  const sel:any=selected;
  const setStyle=(p:Partial<TextStyle>)=>sel&&updateEl(sel.id,x=>({...x,style:{...x.style,...p}}));
  const setBox=(p:Partial<Box>)=>sel&&updateEl(sel.id,x=>({...x,box:{...x.box,...p}}));
  const num=(label:string,value:number,on:(v:number)=>void,step=1,min?:number,max?:number)=><label className="mte-field"><span>{label}</span><input type="number" step={step} min={min} max={max} value={Math.round(value*100)/100} onChange={e=>{const v=parseFloat(e.target.value);if(Number.isFinite(v))on(v)}}/></label>;
  const range=(label:string,value:number,on:(v:number)=>void,min:number,max:number,step=1)=><label className="mte-field mte-wide"><span>{label} <b>{Math.round(value*100)/100}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>on(parseFloat(e.target.value))}/></label>;
  const color=(label:string,value:string,on:(v:string)=>void)=><label className="mte-field"><span>{label}</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(value)?value:'#000000'} onChange={e=>on(e.target.value)}/></label>;

  const library=<aside className={`mte-library ${mobilePanel==='library'?'open':''}`}>
    <h4>Campos do candidato</h4>{groups.map(g=><div key={g} className="mte-group"><small>{g}</small>{CANDIDATE_FIELDS.filter(f=>f.group===g).map(f=><button key={f.key} type="button" className="mte-chip" {...dragItem('field',f.key)}><Type size={13}/>{f.label}</button>)}</div>)}
    <h4>Fotografia</h4><button type="button" className="mte-chip" {...dragItem('photo')}><ImageIcon size={13}/>Área da foto</button>
    <h4>Textos e formas</h4><div className="mte-grid"><button type="button" className="mte-tile" title="Texto fixo" {...dragItem('text')}><Type size={16}/></button><button type="button" className="mte-tile" title="Retângulo" {...dragItem('shape','rect')}><Square size={16}/></button><button type="button" className="mte-tile" title="Círculo" {...dragItem('shape','ellipse')}><Circle size={16}/></button><button type="button" className="mte-tile" title="Linha / divisória" {...dragItem('shape','line')}><Minus size={16}/></button><button type="button" className="mte-tile" title="Triângulo" {...dragItem('shape','triangle')}><Triangle size={16}/></button><button type="button" className="mte-tile" title="Losango" {...dragItem('shape','diamond')}><Diamond size={16}/></button></div>
    <h4>Ícones</h4><input className="mte-search" placeholder="Buscar ícone (em inglês)…" value={iconQuery} onChange={e=>setIconQuery(e.target.value)}/>
    <div className="mte-grid">{iconList.map(n=><button key={n} type="button" className="mte-tile" title={n} {...dragItem('icon',n)} dangerouslySetInnerHTML={{__html:iconSvg(n,'#244b3e',2)}}/>)}</div>
  </aside>;

  const inspector=<aside className={`mte-props ${mobilePanel==='props'?'open':''}`}>
    <h4>Imagens do modelo</h4>
    <div className="mte-images"><div><small>Imagem 1 · gabarito</small>{refUrl?<img src={refUrl} alt="Gabarito"/>:<span>Sem imagem</span>}</div><div><small>Imagem 2 · fundo limpo</small>{cleanUrl?<img src={cleanUrl} alt="Fundo limpo"/>:<span>Não enviada</span>}</div></div>
    <label className="button outline small mte-upload">{cleanBg?'Substituir fundo limpo':'Enviar fundo limpo (imagem 2)'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';if(!f)return;try{setCleanBg(await readImage(f));setDirty(true);setShowClean(true)}catch(err){notify(err instanceof Error?err.message:'Imagem inválida.')}}}/></label>
    {(ratioMismatch||a4Mismatch)&&<div className="mte-warning">{ratioMismatch?'As proporções da imagem 1 e da imagem 2 são diferentes. ':''}{a4Mismatch?'O fundo limpo não tem proporção A4. ':''}Ajuste o enquadramento abaixo para alinhar os campos.</div>}
    {cleanBg&&<div className="mte-row"><label className="mte-field mte-wide"><span>Enquadramento do fundo</span><select value={schema.background.fit} onChange={e=>commit({...schema,background:{...schema.background,fit:e.target.value as any}})}><option value="stretch">Esticar para A4</option><option value="cover">Preencher (corta bordas)</option><option value="contain">Encaixar (sem cortes)</option></select></label>
      {range('Deslocar fundo X',schema.background.offsetX*100,v=>setSchema(s=>({...s,background:{...s.background,offsetX:v/100}})),-10,10,.1)}{range('Deslocar fundo Y',schema.background.offsetY*100,v=>setSchema(s=>({...s,background:{...s.background,offsetY:v/100}})),-10,10,.1)}{range('Escala do fundo',schema.background.scale,v=>setSchema(s=>({...s,background:{...s.background,scale:v}})),.8,1.2,.005)}</div>}
    {!sel?<p className="mte-hint">Clique ou arraste um item da biblioteca para o currículo. Selecione um elemento para editar suas propriedades.</p>:<>
      <h4>{sel.kind==='field'?`Campo: ${CANDIDATE_FIELDS.find(f=>f.key===sel.field)?.label}`:sel.kind==='photo'?'Fotografia':sel.kind==='icon'?`Ícone: ${sel.icon}`:sel.kind==='text'?'Texto fixo':'Forma'}</h4>
      <div className="mte-actions"><button type="button" title="Duplicar" onClick={duplicate}><Copy size={14}/></button><button type="button" title="Trazer para frente" onClick={()=>reorder('top')}><ChevronsUp size={14}/></button><button type="button" title="Subir camada" onClick={()=>reorder('up')}><ArrowUp size={14}/></button><button type="button" title="Descer camada" onClick={()=>reorder('down')}><ArrowDown size={14}/></button><button type="button" title="Enviar para trás" onClick={()=>reorder('bottom')}><ChevronsDown size={14}/></button><button type="button" title="Excluir" className="danger" onClick={remove}><Trash2 size={14}/></button></div>
      <div className="mte-row">{num('X (px)',sel.box.x*PAGE_W,v=>setBox({x:v/PAGE_W}))}{num('Y (px)',sel.box.y*PAGE_H,v=>setBox({y:v/PAGE_H}))}{num('Largura',sel.box.w*PAGE_W,v=>setBox({w:Math.max(4,v)/PAGE_W}))}{num('Altura',sel.box.h*PAGE_H,v=>setBox({h:Math.max(4,v)/PAGE_H}))}{num(sel.kind==='photo'?'Rotação moldura °':'Rotação °',sel.box.rotation,v=>setBox({rotation:v}))}{num('Inclinação °',sel.box.skewX||0,v=>setBox({skewX:v}))}</div>
      {(sel.kind==='field'||sel.kind==='text')&&<div className="mte-row">
        {sel.kind==='text'&&<label className="mte-field mte-wide"><span>Texto</span><textarea rows={2} value={sel.content} onChange={e=>updateEl(sel.id,x=>({...x,content:e.target.value}))}/></label>}
        {sel.kind==='field'&&<label className="mte-field mte-wide"><span>Rótulo antes do valor (opcional)</span><input value={sel.prefix||''} placeholder="Ex.: Tel.: " onChange={e=>updateEl(sel.id,x=>({...x,prefix:e.target.value}))}/></label>}
        <label className="mte-field mte-wide"><span>Fonte</span><select value={sel.style.fontFamily} onChange={e=>setStyle({fontFamily:e.target.value})}>{FONTS.map(f=><option key={f} value={f}>{f.split(',')[0]}</option>)}</select></label>
        {num('Tamanho',sel.style.fontSize,v=>setStyle({fontSize:clamp(v,4,120)}),.5)}
        <label className="mte-field"><span>Peso</span><select value={sel.style.fontWeight} onChange={e=>setStyle({fontWeight:Number(e.target.value)})}>{[300,400,500,600,700,800].map(w=><option key={w}>{w}</option>)}</select></label>
        {color('Cor',sel.style.color,v=>setStyle({color:v}))}
        <label className="mte-field"><span>Itálico</span><select value={sel.style.fontStyle} onChange={e=>setStyle({fontStyle:e.target.value as any})}><option value="normal">Não</option><option value="italic">Sim</option></select></label>
        <label className="mte-field"><span>Alinhamento</span><select value={sel.style.textAlign} onChange={e=>setStyle({textAlign:e.target.value as any})}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option><option value="justify">Justificado</option></select></label>
        <label className="mte-field"><span>Transformação</span><select value={sel.style.textTransform} onChange={e=>setStyle({textTransform:e.target.value as any})}><option value="none">Normal</option><option value="uppercase">MAIÚSCULAS</option><option value="lowercase">minúsculas</option><option value="capitalize">Primeiras Maiúsculas</option></select></label>
        {num('Altura da linha',sel.style.lineHeight,v=>setStyle({lineHeight:clamp(v,.6,4)}),.05)}{num('Espaç. letras',sel.style.letterSpacing,v=>setStyle({letterSpacing:v}),.1)}{num('Espaç. interno',sel.style.padding,v=>setStyle({padding:Math.max(0,v)}))}
        {sel.kind==='field'&&<><label className="mte-field mte-wide"><span>Quando o texto for longo</span><select value={sel.overflow.mode} onChange={e=>updateEl(sel.id,x=>({...x,overflow:{...x.overflow,mode:e.target.value}}))}><option value="grow">Crescer para baixo</option><option value="fixed">Manter área fixa e avisar se exceder</option></select></label>
          {num('Fonte mín.',sel.overflow.minFontSize,v=>updateEl(sel.id,x=>({...x,overflow:{...x.overflow,minFontSize:v}})),.5)}{num('Fonte máx.',sel.overflow.maxFontSize,v=>updateEl(sel.id,x=>({...x,overflow:{...x.overflow,maxFontSize:v}})),.5)}
          <button type="button" className="button outline small mte-wide" onClick={()=>fitFont(sel.id,true)}>Reduzir fonte para caber texto longo de teste</button></>}
      </div>}
      {sel.kind==='icon'&&<div className="mte-row">{color('Cor',sel.color,v=>updateEl(sel.id,x=>({...x,color:v})))}{num('Traço',sel.strokeWidth,v=>updateEl(sel.id,x=>({...x,strokeWidth:clamp(v,.5,4)})),.25)}</div>}
      {sel.kind==='shape'&&<div className="mte-row">{sel.shape!=='line'&&color('Preenchimento',sel.fill,v=>updateEl(sel.id,x=>({...x,fill:v})))}{color('Contorno',sel.stroke,v=>updateEl(sel.id,x=>({...x,stroke:v})))}{num('Espessura',sel.strokeWidth,v=>updateEl(sel.id,x=>({...x,strokeWidth:Math.max(0,v)})))}{sel.shape==='rect'&&num('Cantos',sel.radius,v=>updateEl(sel.id,x=>({...x,radius:Math.max(0,v)})))}{range('Opacidade',sel.opacity,v=>updateEl(sel.id,x=>({...x,opacity:v})),0,1,.05)}</div>}
      {sel.kind==='photo'&&<div className="mte-row">
        <label className="mte-field mte-wide"><span>Formato da moldura</span><select value={sel.frame.shape} onChange={e=>{const shape=e.target.value;const w=sel.box.w*PAGE_W;const dims:Record<string,[number,number]>={circle:[w,w],square:[w,w],horizontal:[w,w*.7],vertical:[w,w*1.33]};updateEl(sel.id,x=>({...x,frame:{...x.frame,shape},box:dims[shape]?{...x.box,h:dims[shape][1]/PAGE_H}:x.box}))}}><option value="circle">Circular</option><option value="square">Quadrado</option><option value="horizontal">Retângulo horizontal</option><option value="vertical">Retângulo vertical</option><option value="rounded">Cantos arredondados</option><option value="custom">Personalizado</option></select></label>
        {(sel.frame.shape==='rounded'||sel.frame.shape==='custom')&&num('Raio cantos',sel.frame.radius,v=>updateEl(sel.id,x=>({...x,frame:{...x.frame,radius:Math.max(0,v)}})))}
        {num('Borda',sel.frame.borderWidth,v=>updateEl(sel.id,x=>({...x,frame:{...x.frame,borderWidth:Math.max(0,v)}})))}{color('Cor borda',sel.frame.borderColor,v=>updateEl(sel.id,x=>({...x,frame:{...x.frame,borderColor:v}})))}
        {range('Zoom da foto',sel.image.zoom,v=>updateEl(sel.id,x=>({...x,image:{...x.image,zoom:v}}),false),1,3,.05)}{range('Posição interna X %',sel.image.posX,v=>updateEl(sel.id,x=>({...x,image:{...x.image,posX:v}}),false),0,100)}{range('Posição interna Y %',sel.image.posY,v=>updateEl(sel.id,x=>({...x,image:{...x.image,posY:v}}),false),0,100)}{range('Rotação da foto °',sel.image.rotation,v=>updateEl(sel.id,x=>({...x,image:{...x.image,rotation:v}}),false),-180,180)}
        <p className="mte-hint mte-wide">A foto do candidato nunca é deformada: ela preenche a moldura mantendo a proporção, e o zoom/posição controlam o recorte. A rotação da moldura fica nas dimensões acima.</p>
      </div>}
    </>}
    <h4><Layers size={14}/> Camadas</h4><div className="mte-layers">{[...schema.elements].reverse().map(el=><button type="button" key={el.id} className={el.id===selectedId?'active':''} onClick={()=>setSelectedId(el.id)}>{el.kind==='field'?CANDIDATE_FIELDS.find(f=>f.key===el.field)?.label:el.kind==='icon'?`Ícone ${el.icon}`:el.kind==='photo'?'Foto':el.kind==='text'?el.content.slice(0,24):`Forma ${el.shape}`}</button>)}{!schema.elements.length&&<small>Nenhum elemento.</small>}</div>
  </aside>;

  function fitFont(id:string,long:boolean){
    const el=schema.elements.find(e=>e.id===id);if(!el||el.kind!=='field')return;
    const probe=document.createElement('div');const f=CANDIDATE_FIELDS.find(x=>x.key===el.field)!;const text=long&&f.long?Array(4).fill(f.sample).join('\n'):f.sample;
    Object.assign(probe.style,{position:'absolute',visibility:'hidden',left:'-9999px',width:`${el.box.w*PAGE_W}px`,fontFamily:el.style.fontFamily,fontWeight:String(el.style.fontWeight),lineHeight:String(el.style.lineHeight),letterSpacing:`${el.style.letterSpacing}px`,padding:`${el.style.padding}px`,whiteSpace:'pre-wrap',overflowWrap:'anywhere',boxSizing:'border-box'});probe.textContent=(el.prefix||'')+text;document.body.appendChild(probe);
    let size=el.overflow.maxFontSize;const maxH=el.box.h*PAGE_H;while(size>el.overflow.minFontSize){probe.style.fontSize=`${size}px`;if(probe.scrollHeight<=maxH)break;size-=.5}probe.style.fontSize=`${size}px`;const fits=probe.scrollHeight<=maxH;probe.remove();
    updateEl(id,x=>({...x,style:{...x.style,fontSize:size}}));notify(fits?`Fonte ajustada para ${size}px.`:`Mesmo com a fonte mínima (${size}px) o texto de teste não cabe. Aumente a área ou use “Crescer para baixo”.`);
  }

  return <div className="mte-shell" role="dialog" aria-modal="true" aria-label={`Editor manual do modelo ${template.name}`}>
    <header className="mte-top"><button type="button" className="ghost-icon" onClick={close} aria-label="Fechar editor"><X size={18}/></button><div className="mte-title"><span className="eyebrow">EDITOR MANUAL</span><b>{template.name}</b></div>
      <div className="mte-tools"><button type="button" onClick={undo} disabled={!past.length} title="Desfazer (Ctrl+Z)"><Undo2 size={16}/></button><button type="button" onClick={redo} disabled={!future.length} title="Refazer (Ctrl+Y)"><Redo2 size={16}/></button><span className="mte-sep"/><button type="button" onClick={()=>setZoom(z=>clamp(z-.1,.25,2))} title="Diminuir zoom"><ZoomOut size={16}/></button><span className="mte-zoom">{Math.round(zoom*100)}%</span><button type="button" onClick={()=>setZoom(z=>clamp(z+.1,.25,2))} title="Aumentar zoom"><ZoomIn size={16}/></button><span className="mte-sep"/>
        <label className="mte-opacity" title="Transparência do gabarito (imagem 1)"><Eye size={14}/><input type="range" min={0} max={1} step={.05} value={refOpacity} onChange={e=>setRefOpacity(parseFloat(e.target.value))}/></label>
        <label className="mte-toggle"><input type="checkbox" checked={showClean} onChange={e=>setShowClean(e.target.checked)}/>Fundo limpo</label>
        <button type="button" onClick={()=>runTest(false)} title="Testar com dados fictícios"><FlaskConical size={16}/> Testar</button></div>
      <button type="button" className="button primary small" disabled={saving} onClick={save}><Save size={14}/>{saving?'Salvando…':'Salvar modelo'}</button></header>
    <div className="mte-mobile-bar"><button type="button" onClick={()=>setMobilePanel(p=>p==='library'?'none':'library')}><PanelLeft size={15}/> Elementos</button><button type="button" onClick={()=>setMobilePanel(p=>p==='props'?'none':'props')}><SlidersHorizontal size={15}/> Propriedades</button></div>
    <div className="mte-body">{library}
      <main className="mte-stage" onPointerDown={()=>setSelectedId(null)} onDragOver={e=>e.preventDefault()} onDrop={onDrop}>
        <div className="mte-page-wrap" style={{width:PAGE_W*zoom,height:PAGE_H*zoom}}>
          <div ref={pageRef} className="mte-page" style={{transform:`scale(${zoom})`}}>
            {showClean&&cleanUrl&&<img src={cleanUrl} alt="" style={{...cssToObj(backgroundCss(schema)),pointerEvents:'none'}}/>}
            {refUrl&&<img src={refUrl} alt="" className="mte-ref" style={{opacity:cleanUrl&&showClean?refOpacity:Math.max(refOpacity,.9)}}/>}
            {schema.elements.map((el,i)=>!el.hidden&&<div key={el.id} className={`mte-el ${el.id===selectedId?'selected':''}`} style={{left:el.box.x*PAGE_W,top:el.box.y*PAGE_H,width:el.box.w*PAGE_W,height:el.box.h*PAGE_H,zIndex:i+5,transform:`rotate(${el.box.rotation}deg) skewX(${el.box.skewX||0}deg)`}} onPointerDown={e=>startDrag(e,el,'move')}>
              <ElementView el={el}/>
              {el.id===selectedId&&HANDLES.map(h=><span key={h} className={`mte-handle h-${h}`} style={{transform:`scale(${1/zoom})`}} onPointerDown={e=>startDrag(e,el,h)}/>)}
            </div>)}
          </div>
        </div>
      </main>
      {inspector}
    </div>
    {test&&<div className="admin-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setTest(null)}}><div className="admin-modal mte-test"><div className="admin-modal-head"><h3>Teste com candidato fictício</h3><button type="button" className="ghost-icon" onClick={()=>setTest(null)} aria-label="Fechar"><X size={18}/></button></div>
      <div className="admin-modal-body"><div className="mte-actions"><button type="button" className={!test.long?'active':''} onClick={()=>runTest(false)}>Textos normais</button><button type="button" className={test.long?'active':''} onClick={()=>runTest(true)}>Textos longos</button></div>
        {test.overflow.length?<div className="mte-warning">Conteúdo excede a área configurada em: {test.overflow.map(k=>CANDIDATE_FIELDS.find(f=>f.key===k)?.label||k).join(', ')}. Nenhuma informação é escondida, mas pode sobrepor outros elementos.</div>:<div className="mte-ok">Todos os campos couberam nas áreas configuradas.</div>}
        <div className="mte-test-frame"><div ref={testRef} style={{transform:'scale(.5)',transformOrigin:'top left',width:PAGE_W}} dangerouslySetInnerHTML={{__html:test.html}}/></div></div></div></div>}
  </div>;
}

function cssToObj(css:string):React.CSSProperties{const o:Record<string,string>={};css.split(';').forEach(p=>{const i=p.indexOf(':');if(i>0){const k=p.slice(0,i).trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase());o[k]=p.slice(i+1).trim()}});return o as React.CSSProperties}
