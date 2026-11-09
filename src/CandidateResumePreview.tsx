import { useLayoutEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import ResolvedImage from './ResolvedImage';

export type ResumePreviewCandidate = {
  name:string; email:string; phone:string; city:string; role:string; summary:string; experience:string;
  education:string; skills:string; linkedin:string; photoUrl?:string; birthDate?:string; maritalStatus?:string;
  nationality?:string; driverLicense?:string; portfolio?:string;
};
export type ResumePreviewTemplate = { id:string; name:string; color:string; layout:number; preview_url?:string; generated_html?:string|null };

export function fillTemplateHtml(template:ResumePreviewTemplate,candidate:ResumePreviewCandidate):string{
  const photo=candidate.photoUrl||'';
  const values:Record<string,string>={
    name:candidate.name,full_name:candidate.name,fullname:candidate.name,nome:candidate.name,
    role:candidate.role,job_title:candidate.role,profession:candidate.role,profissao:candidate.role,cargo:candidate.role,
    email:candidate.email,phone:candidate.phone,telefone:candidate.phone,whatsapp:candidate.phone,
    city:candidate.city,address:candidate.city,endereco:candidate.city,
    summary:candidate.summary,objective:candidate.summary,objetivo:candidate.summary,
    experience:candidate.experience,experiencia:candidate.experience,experiencias:candidate.experience,
    education:candidate.education,educacao:candidate.education,formacao:candidate.education,
    skills:candidate.skills,competencias:candidate.skills,habilidades:candidate.skills,
    linkedin:candidate.linkedin,portfolio:candidate.portfolio||'',
    birthdate:candidate.birthDate||'',data_nascimento:candidate.birthDate||'',
    maritalstatus:candidate.maritalStatus||'',estado_civil:candidate.maritalStatus||'',
    nationality:candidate.nationality||'',nacionalidade:candidate.nationality||'',
    driverlicense:candidate.driverLicense||'',cnh:candidate.driverLicense||'',
    photourl:photo,photo_url:photo,photo,imagem:photo,foto:photo,foto_perfil:photo
  };
  const normalizeKey=(key:string)=>key.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'');
  const normalized=Object.fromEntries(Object.entries(values).map(([name,value])=>[normalizeKey(name),value]));
  const escaped=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));
  const photoKeys=new Set(['photo','photourl','photo_url','imagem','foto','foto_perfil']);
  return (template.generated_html||'').replace(/\{\{\s*(?:candidate\.)?([\p{L}\p{N}_]+)\s*\}\}/giu,(placeholder,key:string,offset:number,source:string)=>{
    const lookupKey=normalizeKey(key);const value=normalized[lookupKey];if(value===undefined)return placeholder;
    if(photoKeys.has(lookupKey)){
      const tagStart=source.lastIndexOf('<',offset);const tagEnd=source.lastIndexOf('>',offset);const beforeToken=source.slice(tagStart,offset);const afterToken=source.slice(offset+placeholder.length);
      const inTag=tagStart>tagEnd;const inImageAttribute=inTag&&/<img\b/i.test(beforeToken)&&/\bsrc\s*=\s*["']?[^"']*$/i.test(beforeToken);const inCssUrl=/url\(\s*["']?$/i.test(beforeToken)&&/^\s*["']?\s*\)/.test(afterToken);
      if(inImageAttribute||inCssUrl)return escaped(value);
      if(!value)return '';
      return `<img src="${escaped(value)}" alt="Foto do candidato" style="display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover;object-position:center 30%;border-radius:50%;image-rendering:-webkit-optimize-contrast;backface-visibility:hidden"/>`;
    }
    return escaped(value).replace(/\r?\n/g,'<br>');
  });
}

function GeneratedResumeFrame({template,candidate}:{template:ResumePreviewTemplate;candidate:ResumePreviewCandidate}){
  const hostRef=useRef<HTMLDivElement>(null);
  const [scale,setScale]=useState(1);
  useLayoutEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    const measure=()=>setScale(Math.min(1,host.clientWidth/794));
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(host);
    return()=>observer.disconnect();
  },[]);
  return <div ref={hostRef} className="resume-generated-template" style={{height:`${1123*scale}px`}}><iframe title={`Prévia preenchida do modelo ${template.name}`} sandbox="" srcDoc={fillTemplateHtml(template,candidate)} style={{transform:`translateX(-50%) scale(${scale})`}}/></div>;
}

export default function CandidateResumePreview({candidate,template}:{candidate:ResumePreviewCandidate;template:ResumePreviewTemplate}){
  if(template.generated_html?.trim())return <GeneratedResumeFrame candidate={candidate} template={template}/>;
  if(template.preview_url)return <div className="resume-template-not-ready"><div className="resume-reference-card"><span className="eyebrow">MODELO ESCOLHIDO</span><ResolvedImage source={template.preview_url} id={`resume-${template.id}`} className="resume-reference-image" alt={`Imagem original do modelo ${template.name}`} loading="eager"/><b>{template.name}</b></div><div className="resume-template-notice"><Sparkles size={20}/><h3>Este modelo está cadastrado como imagem de referência.</h3><p>Para preencher o próprio design com seus dados, a imagem precisa ser convertida em um modelo HTML editável. Essa estrutura será gerada e salva pelo processamento de templates no backend.</p><div><b>Dados que serão aplicados</b><span>{candidate.name||'Seu nome completo'} · {candidate.role||'Seu cargo desejado'}</span><span>{[candidate.email,candidate.phone,candidate.city].filter(Boolean).join(' · ')||'Seus contatos'}</span></div></div></div>;
  const contacts=[candidate.email,candidate.phone,candidate.city,candidate.linkedin,candidate.portfolio].filter(Boolean);
  const skills=candidate.skills.split(/[,;\n]/).map(item=>item.trim()).filter(Boolean);
  const additional=[candidate.birthDate&&`Nascimento: ${new Date(`${candidate.birthDate}T00:00:00`).toLocaleDateString('pt-BR')}`,candidate.maritalStatus,candidate.nationality,candidate.driverLicense&&candidate.driverLicense!=='Não possuo'?`CNH ${candidate.driverLicense}`:''].filter(Boolean);
  return <article className={`resume-preview-document resume-layout-${template.layout%3}`} onContextMenu={event=>event.preventDefault()}><header className="resume-preview-header" style={{backgroundColor:template.color}}>{candidate.photoUrl?<img src={candidate.photoUrl} alt="Foto do candidato"/>:<span className="resume-preview-avatar">{candidate.name?.trim()?.[0]?.toUpperCase()||'C'}</span>}<div><h2>{candidate.name||'Seu nome completo'}</h2><h3>{candidate.role||'Área ou cargo desejado'}</h3></div></header><div className="resume-preview-columns"><aside className="resume-preview-sidebar">{contacts.length>0&&<section><h4>Contato</h4>{contacts.map((value,index)=><p key={`${value}-${index}`}>{value}</p>)}</section>}{candidate.education&&<section><h4>Formação</h4><p>{candidate.education}</p></section>}{skills.length>0&&<section><h4>Competências</h4><ul>{skills.map((skill,index)=><li key={`${skill}-${index}`}>{skill}</li>)}</ul></section>}{additional.length>0&&<section><h4>Informações adicionais</h4>{additional.map((value,index)=><p key={`${value}-${index}`}>{value}</p>)}</section>}</aside><main className="resume-preview-content">{candidate.summary&&<section><h4>Resumo profissional</h4><p>{candidate.summary}</p></section>}{candidate.experience&&<section><h4>Experiência profissional</h4><p>{candidate.experience}</p></section>}{!candidate.summary&&!candidate.experience&&!candidate.education&&!skills.length&&<p className="resume-preview-empty">Complete seus dados para visualizar o currículo.</p>}</main></div></article>;
}
