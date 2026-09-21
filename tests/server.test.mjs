import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createServer} from '../server.mjs';
import {packedIndex,readStoredAsset} from '../storage.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('every packaged route decodes to the shipped bytes, with correct WASM MIME and hash',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const root=new URL('../web/',import.meta.url),files=await readdir(root,{recursive:true,withFileTypes:true});
  let verified=0;
  const names=[...files.filter(e=>e.isFile()).map(e=>path.relative(fileURLToPath(root),path.join(e.parentPath,e.name)).split(path.sep).join('/')),...Object.keys(packedIndex)];
  for(const name of new Set(names)){
   let route=name;
   let expected=readStoredAsset(name);
   const explicitGzip=route==='assets/quality/lods.bin.gz';
   if(route.endsWith('.gz')&&!explicitGzip){route=route.slice(0,-3);expected=gunzipSync(expected);}
   if(route.endsWith('.png.webp'))route=route.slice(0,-5);
   const response=await fetch(base+'/'+route);
   assert.equal(response.status,200,route);
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected,route);
   if(route.endsWith('.wasm'))assert.equal(response.headers.get('content-type'),'application/wasm');
   if(route.endsWith('.mjs'))assert.match(response.headers.get('content-type'),/^text\/javascript/);
   if(route==='physics/rocketsim-profile-core.wasm')assert.equal(createHash('sha256').update(expected).digest('hex'),'be733fcfa8bd0b14e25bbe99ac97420647a28c3534a95504ef797dd50665c5c4');
   verified++;
  }
  assert(verified>250);console.log(`Verified ${verified} packaged files`);
  assert.equal((await fetch(base+'/missing-file')).status,404);
  assert.equal((await fetch(base+'/%2e%2e%5cpackage.json')).status,403);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  const first=await fetch(base+'/assets/original/geometry.json');await first.arrayBuffer();
  assert.equal((await fetch(base+'/assets/original/geometry.json',{headers:{'If-None-Match':first.headers.get('etag')}})).status,304);
  const plain=await fetch(base+'/assets/original/geometry.json',{headers:{'Accept-Encoding':'identity'}});
  assert.equal(plain.headers.get('content-encoding'),null);assert((await plain.json())!==null);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
