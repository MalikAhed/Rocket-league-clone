import {readFileSync,statSync,createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const webRoot=fileURLToPath(new URL('./web/',import.meta.url));
const packedRoot=fileURLToPath(new URL('./packed/',import.meta.url));
export const packedIndex=JSON.parse(readFileSync(new URL('./packed/index.json',import.meta.url),'utf8'));
export function storedAsset(name){
 const target=path.resolve(webRoot,name);
 if(!target.startsWith(webRoot))return null;
 try{const s=statSync(target);if(s.isFile())return {file:target,size:s.size,etag:`W/"${s.size}-${s.mtimeMs}"`};}catch{}
 const entry=packedIndex[name];
 if(!entry)return null;
 const segments=(entry.segments??[entry]).map(s=>({file:path.join(packedRoot,s.pack),start:s.offset,end:s.offset+s.size-1}));
 return {file:segments[0].file,segments,size:entry.size,etag:`W/"${entry.sha256}"`};
}
export function streamStoredAsset(item){
 if(!item.segments)return createReadStream(item.file);
 return Readable.from((async function*(){for(const s of item.segments)yield* createReadStream(s.file,{start:s.start,end:s.end});})());
}
export function readStoredAsset(name){
 const item=storedAsset(name);if(!item)throw Error(`Missing asset: ${name}`);
 if(!item.segments)return readFileSync(item.file);
 return Buffer.concat(item.segments.map(s=>readFileSync(s.file).subarray(s.start,s.end+1)));
}
