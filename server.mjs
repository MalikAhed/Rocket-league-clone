import http from 'node:http';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createGunzip} from 'node:zlib';
import {webRoot as root,storedAsset,streamStoredAsset} from './storage.mjs';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.gltf':'model/gltf+json','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.gz':'application/gzip'};
export function createServer(){return http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.endsWith('/'))pathname+='index.html';
  const target=path.resolve(root,'.'+pathname);
  if(!target.startsWith(root)||pathname.includes('\\')||pathname.includes('\0')){res.writeHead(403).end();return;}
  let file,info,encoded=false,logical;
  const requested=path.relative(root,target).split(path.sep).join('/');
  for(const candidate of [requested,requested+'.webp',requested+'.gz']){
   const s=storedAsset(candidate);
   if(s){file=s.file;info=s;logical=candidate;encoded=candidate===requested+'.gz';break;}
  }
  if(!file){console.error('404',pathname);res.writeHead(404).end('Not found');return;}
  const acceptsGzip=/(?:^|,)\s*gzip\s*(?:,|$|;\s*q=(?!0(?:\.0*)?(?:\s*,|\s*$)))/i.test(req.headers['accept-encoding']??'');
  const headers={'Content-Type':types[path.extname(logical.endsWith('.webp')?logical:target)]??'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Vary':'Accept-Encoding'};
  if(encoded&&acceptsGzip)headers['Content-Encoding']='gzip';
  headers.ETag=info.etag;
  if(req.headers['if-none-match']===info.etag){res.writeHead(304,headers).end();return;}
  if(!encoded||acceptsGzip)headers['Content-Length']=info.size;
  res.writeHead(200,headers);
  if(req.method==='HEAD'){res.end();return;}
  const stream=streamStoredAsset(info);stream.on('error',()=>res.destroy());
  if(encoded&&!acceptsGzip){const unzip=createGunzip();unzip.on('error',()=>res.destroy());stream.pipe(unzip).pipe(res);}else stream.pipe(res);
 }catch{if(!res.headersSent)res.writeHead(400);res.end('Bad request');}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT??4188),host=process.env.HOST??'127.0.0.1';
 createServer().listen(port,host,()=>console.log(`Beckwith Park: http://${host}:${port}`));
}

