import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { supabase } from './integrations/supabase/client';
import ResolvedImage from './ResolvedImage';
import type { ResumePreviewCandidate } from './CandidateResumePreview';

type Resume = ResumePreviewCandidate;
type ChatRole='user'|'assistant';
type ChatMessage={id:string;role:ChatRole;text:string};
type PublicAssistantConfig={assistant_name:string;assistant_avatar_url:string|null;enabled:boolean;welcome_message:string};
type ResumePatch={
  fullName?:string;jobTitle?:string;email?:string;phone?:string;address?:string;linkedin?:string;portfolio?:string;summary?:string;
  experiences?:Array<{company?:string;role?:string;period?:string;description?:string}>;
  education?:Array<{institution?:string;course?:string;period?:string}>;courses?:string[];skills?:string[];languages?:string[];
};
type AssistantChatProps={candidate:Resume;onUpdateCandidate:(updated:Resume)=>void};
const DEFAULT_WELCOME='Olá! Eu sou a Anya, sua assistente de entrevista. Vou ajudar você a contar sua trajetória profissional. Para começar, qual é o seu nome completo?';
const makeMessage=(role:ChatRole,text:string):ChatMessage=>({id:crypto.randomUUID(),role,text});

export default function AssistantChat({candidate,onUpdateCandidate}:AssistantChatProps){
  const [config,setConfig]=useState<PublicAssistantConfig|null>(null);
  const [isOpen,setIsOpen]=useState(false);
  const [showHint,setShowHint]=useState(false);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [input,setInput]=useState('');
  const [isLoading,setIsLoading]=useState(false);
  const [isDone,setIsDone]=useState(false);
  const endRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLTextAreaElement>(null);

  useEffect(()=>{let active=true;const loadConfig=async()=>{try{const {data,error}=await supabase.rpc('get_public_assistant_config');if(!active||error)return;const row=data?.[0];if(!row?.enabled)return;const next:PublicAssistantConfig={assistant_name:row.assistant_name||'Anya',assistant_avatar_url:row.assistant_avatar_url||null,enabled:row.enabled,welcome_message:row.welcome_message||DEFAULT_WELCOME};setConfig(next);setMessages([makeMessage('assistant',next.welcome_message)]);setShowHint(true)}catch{/* Chat stays hidden when public settings cannot be loaded. */}};void loadConfig();return()=>{active=false}},[]);
  useEffect(()=>{if(!showHint)return;const timer=window.setTimeout(()=>setShowHint(false),7000);return()=>window.clearTimeout(timer)},[showHint]);
  useEffect(()=>{if(isOpen)endRef.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages,isLoading,isOpen]);
  useEffect(()=>{if(!isOpen)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setIsOpen(false)};window.addEventListener('keydown',key);document.body.classList.add('assistant-chat-open');inputRef.current?.focus();return()=>{window.removeEventListener('keydown',key);document.body.classList.remove('assistant-chat-open')}},[isOpen]);

  if(!config?.enabled)return null;

  const restart=()=>{setMessages([makeMessage('assistant',config.welcome_message)]);setInput('');setIsDone(false);setIsLoading(false)};
  const applyPatch=(patch:ResumePatch)=>{
    const updated:Resume={...candidate};
    if(patch.fullName!==undefined)updated.name=patch.fullName;
    if(patch.jobTitle!==undefined)updated.role=patch.jobTitle;
    if(patch.email!==undefined)updated.email=patch.email;
    if(patch.phone!==undefined)updated.phone=patch.phone;
    if(patch.address!==undefined)updated.city=patch.address;
    if(patch.linkedin!==undefined)updated.linkedin=patch.linkedin;
    if(patch.portfolio!==undefined)updated.portfolio=patch.portfolio;
    if(patch.summary!==undefined)updated.summary=patch.summary;
    if(Array.isArray(patch.experiences)&&patch.experiences.length>0){updated.experience=patch.experiences.map(exp=>`${exp.role||''} — ${exp.company||''}${exp.period?` (${exp.period})`:''}\n${exp.description||''}`.trim()).join('\n\n')}
    const eduItems=(patch.education||[]).map(item=>`${item.course||''} — ${item.institution||''}${item.period?` (${item.period})`:''}`.trim());
    const courseItems=(patch.courses||[]).map(course=>`Curso: ${course}`);
    if(eduItems.length||courseItems.length)updated.education=[...eduItems,...courseItems].filter(Boolean).join('\n');
    const skillItems=[...(patch.skills||[]),...(patch.languages||[]).map(language=>`Idioma: ${language}`)];
    if(skillItems.length)updated.skills=skillItems.join(', ');
    onUpdateCandidate(updated);
  };
  const sendMessage=async()=>{
    const text=input.trim();if(!text||isLoading)return;
    const userMessage=makeMessage('user',text);const nextMessages=[...messages,userMessage];setMessages(nextMessages);setInput('');setIsLoading(true);
    if(inputRef.current)inputRef.current.style.height='auto';
    try{
      const {data,error}=await supabase.functions.invoke('assistant-interview',{body:{messages:nextMessages.map(({role,text})=>({role,text})),resume:candidate}});
      if(error||!data?.ok){setMessages(current=>[...current,makeMessage('assistant',data?.error||error?.message||'Não consegui responder agora. Tente novamente em instantes.')]);return}
      if(data.resume_patch&&typeof data.resume_patch==='object')applyPatch(data.resume_patch as ResumePatch);
      const response=makeMessage('assistant',typeof data.reply==='string'&&data.reply.trim()?data.reply.trim():'Entendi. Pode me contar mais?');
      const additions=[response];
      if(data.done===true){setIsDone(true);additions.push(makeMessage('assistant','Sua entrevista foi concluída! Confira os dados na prévia do currículo e escolha o modelo que mais combina com você.'))}
      setMessages(current=>[...current,...additions]);
    }catch(error){setMessages(current=>[...current,makeMessage('assistant',error instanceof Error?error.message:'Não foi possível conectar à assistente. Tente novamente.')])}finally{setIsLoading(false)}
  };

  return <>
    <div className="assistant-launcher-wrap">{showHint&&!isOpen&&<div className="assistant-launcher-tooltip">Montar meu currículo com a {config.assistant_name}<span/> </div>}<button type="button" className="assistant-launcher-btn" aria-label={`Conversar com ${config.assistant_name}`} aria-expanded={isOpen} onClick={()=>{setShowHint(false);setIsOpen(value=>!value)}}>{config.assistant_avatar_url?<ResolvedImage source={config.assistant_avatar_url} kind="template" id="assistant-launcher-avatar" alt={config.assistant_name} className="assistant-launcher-avatar"/>:<span className="assistant-launcher-fallback"><Bot size={26}/><Sparkles size={12}/></span>}<i className="assistant-launcher-badge"/></button><span className="assistant-pulse-ring"/></div>
    {isOpen&&<div className="assistant-chat-modal" role="dialog" aria-modal="true" aria-label={`Chat com ${config.assistant_name}`}>
      <header className="assistant-chat-header"><div className="assistant-chat-avatar">{config.assistant_avatar_url?<ResolvedImage source={config.assistant_avatar_url} kind="template" id="assistant-chat-header-avatar" alt={config.assistant_name} className="assistant-chat-avatar-image"/>:<Bot size={19}/>}</div><div className="assistant-chat-heading"><b>{config.assistant_name}</b><span><i/> Pronta para ajudar</span></div><button type="button" className="assistant-chat-icon-btn" title="Reiniciar conversa" aria-label="Reiniciar conversa" onClick={restart}><RotateCcw size={16}/></button><button type="button" className="assistant-chat-icon-btn" title="Fechar conversa" aria-label="Fechar conversa" onClick={()=>setIsOpen(false)}><X size={19}/></button></header>
      <div className="assistant-chat-messages" aria-live="polite">{messages.map(message=><div key={message.id} className={`assistant-chat-row ${message.role==='user'?'user':'assistant'}`}>{message.role==='assistant'&&<span className="assistant-chat-message-avatar">{config.assistant_avatar_url?<ResolvedImage source={config.assistant_avatar_url} kind="template" id={`assistant-msg-${message.id}`} alt="" className="assistant-chat-avatar-image"/>:<Bot size={13}/>}</span>}<div className="assistant-chat-bubble">{message.text}</div></div>)}{isLoading&&<div className="assistant-chat-row assistant"><span className="assistant-chat-message-avatar">{config.assistant_avatar_url?<ResolvedImage source={config.assistant_avatar_url} kind="template" id="assistant-typing-avatar" alt="" className="assistant-chat-avatar-image"/>:<Bot size={13}/>}</span><div className="assistant-chat-typing"><span/><span/><span/></div><small>{config.assistant_name} está digitando...</small></div>}<div ref={endRef}/></div>
      {isDone&&<div className="assistant-chat-done"><Sparkles size={15}/> Seus dados estão prontos para conferir na prévia.</div>}
      <div className="assistant-chat-input-area"><textarea ref={inputRef} rows={1} value={input} disabled={isLoading} placeholder="Escreva sua resposta…" aria-label="Sua mensagem" onChange={event=>{setInput(event.target.value);event.currentTarget.style.height='auto';event.currentTarget.style.height=`${Math.min(event.currentTarget.scrollHeight,120)}px`}} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void sendMessage()}}}/><button type="button" aria-label="Enviar mensagem" title="Enviar mensagem" disabled={!input.trim()||isLoading} onClick={()=>void sendMessage()}><Send size={17}/></button></div>
      <div className="assistant-chat-footnote">Seus dados são preenchidos no currículo enquanto conversamos.</div>
    </div>}
  </>;
}
