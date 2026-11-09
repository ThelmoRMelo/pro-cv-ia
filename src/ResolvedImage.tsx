import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { classifyImageSource, resolveImageSource } from './lib/imageSources';
import type { ImageKind } from './lib/imageSources';

export default function ResolvedImage({source,kind='template',id,alt,className='',loading='lazy'}:{source?:string;kind?:ImageKind;id:string;alt:string;className?:string;loading?:'lazy'|'eager'}){
  const [url,setUrl]=useState('');
  const [failed,setFailed]=useState(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let alive=true;let revoke:(()=>void)|undefined;
    setUrl('');setFailed(false);
    resolveImageSource(source||'',kind).then(result=>{if(!alive){result.revoke?.();return}revoke=result.revoke;setUrl(result.url)},()=>{if(alive)setFailed(true)});
    const online=()=>setRetry(value=>value+1);
    window.addEventListener('online',online);
    const timer=window.setInterval(online,240000);
    return()=>{alive=false;revoke?.();window.removeEventListener('online',online);window.clearInterval(timer)};
  },[source,kind,retry]);
  const diagnostic=(message:string)=>console.warn('Image load',{id,format:classifyImageSource(source||''),message});
  if(failed)return <span className={`image-unavailable ${className}`} role="img" aria-label={`${alt}: imagem indisponível`} title="Imagem indisponível. Verifique a referência cadastrada."><ImageOff size={22}/><span>Imagem indisponível</span></span>;
  if(!url)return <span className={`image-unavailable ${className}`} role="status" aria-label={`Carregando ${alt}`}>Carregando imagem…</span>;
  return <img className={className} src={url} alt={alt} loading={loading} data-image-id={id} onError={()=>{diagnostic('Falha ao carregar ou decodificar');if(retry===0)setRetry(1);else setFailed(true)}} onLoad={event=>{if(!event.currentTarget.naturalWidth){diagnostic('Imagem sem dimensões');setFailed(true)}}}/>;
}