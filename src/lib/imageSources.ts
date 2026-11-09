import { supabase } from '../integrations/supabase/client';

export type ImageKind = 'template' | 'pix';
export function classifyImageSource(source:string){
  if(source.startsWith('data:image/'))return 'data';
  if(source.startsWith('blob:'))return 'blob';
  if(/^https?:\/\//i.test(source))return 'url';
  if(source.startsWith('/')&&!source.startsWith('/storage/'))return 'asset';
  return 'storage';
}
export function storageLocation(source:string,kind:ImageKind):{bucket:string;path:string}|null{
  const match=source.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if(match)return {bucket:match[1],path:decodeURIComponent(match[2])};
  if(classifyImageSource(source)!=='storage')return null;
  const clean=source.replace(/^\/+/, '');
  const known=['template-references','pix-qr-codes','qr-codes'];
  const bucket=known.find(name=>clean.startsWith(`${name}/`));
  return {bucket:bucket|| (kind==='template'?'template-references':'pix-qr-codes'),path:bucket?clean.slice(bucket.length+1):clean};
}
export async function resolveImageSource(source:string,kind:ImageKind):Promise<{url:string;revoke?:()=>void}>{
  if(!source)throw new Error('Imagem não cadastrada.');
  if(classifyImageSource(source)==='data'){
    const blob=await (await fetch(source)).blob();
    const url=URL.createObjectURL(blob);
    return {url,revoke:()=>URL.revokeObjectURL(url)};
  }
  const location=storageLocation(source,kind);
  if(!location)return {url:source};
  if(location.bucket==='template-references')return {url:supabase.storage.from(location.bucket).getPublicUrl(location.path).data.publicUrl};
  // Always re-sign persisted Storage URLs instead of trusting an expired token.
  const {data,error}=await supabase.storage.from(location.bucket).createSignedUrl(location.path,300);
  if(error||!data?.signedUrl)throw new Error('Não foi possível acessar a imagem armazenada.');
  return {url:data.signedUrl};
}
export async function persistImageSource(source:string,kind:ImageKind):Promise<string>{
  if(classifyImageSource(source)!=='data')return source;
  const blob=await (await fetch(source)).blob();
  if(!['image/jpeg','image/png','image/webp'].includes(blob.type)||blob.size>5*1024*1024)throw new Error('Envie JPEG, PNG ou WebP de até 5 MB.');
  const bucket=kind==='template'?'template-references':'pix-qr-codes';
  const extension=blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg';
  const path=`${crypto.randomUUID()}.${extension}`;
  const {error}=await supabase.storage.from(bucket).upload(path,blob,{contentType:blob.type,upsert:false});
  if(error)throw new Error('Não foi possível salvar a imagem. Tente novamente.');
  return kind==='template'?supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl:`${bucket}/${path}`;
}
