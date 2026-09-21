import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packedIndex,storedAsset,readStoredAsset} from '../storage.mjs';
test('local module imports and worker entry points exist',async()=>{
 const root=fileURLToPath(new URL('../web/',import.meta.url));
 const files=await readdir(root,{recursive:true,withFileTypes:true});
 const names=[...files.filter(e=>e.isFile()).map(e=>path.relative(root,path.join(e.parentPath,e.name)).split(path.sep).join('/')),...Object.keys(packedIndex)];
 let checked=0;
 for(const name of names){
  if(! /\.(?:m?js)(?:\.gz)?$/.test(name))continue;
  const file=path.join(root,name);let data=readStoredAsset(name);
  if(name.endsWith('.gz'))data=gunzipSync(data);
  const source=data.toString();
  const references=[...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|new URL\(\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]);
  for(const ref of references){
   if(!ref.startsWith('.')&&!ref.startsWith('/'))continue;
   const target=ref.startsWith('/')?path.join(root,ref):path.resolve(path.dirname(file),ref.split('?')[0]);
   if(ref==='.'||ref.endsWith('/')){assert(names.some(n=>n.startsWith(path.relative(root,target).split(path.sep).join('/')+'/')));continue;}
   let found=false;for(const suffix of ['','.gz','.webp'])if(storedAsset(path.relative(root,target).split(path.sep).join('/')+suffix)){found=true;break;}
   assert(found,`${path.relative(root,file)} imports missing ${ref}`);checked++;
  }
 }
 assert(checked>50);console.log(`Verified ${checked} module/worker references`);
});

