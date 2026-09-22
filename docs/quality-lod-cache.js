// Content fingerprint includes source UVs, normals and baked lighting as well
// as topology. A changed export cannot accidentally reuse an old LOD.
export function geometryLODKey(geometry,limits){
 let hash=2166136261;
 const arrays=[geometry.index,...['position','normal','uv','sourceLightmapUV','sourceBakedLight0','sourceBakedLight1','sourceColor'].map(n=>geometry.attributes[n])];
 for(const attribute of arrays){
  if(!attribute){hash=Math.imul(hash^0,16777619);continue;}
  hash=Math.imul(hash^attribute.count,16777619);hash=Math.imul(hash^attribute.itemSize,16777619);
  const a=attribute.array,words=a.BYTES_PER_ELEMENT===4?new Uint32Array(a.buffer,a.byteOffset,a.length):a;
  for(let i=0;i<words.length;i++)hash=Math.imul(hash^words[i],16777619);
 }
 return (hash>>>0).toString(16)+'-'+limits.join('-');
}

export async function loadGeometryLODs(){
 try{
  const compressed=typeof DecompressionStream!=='undefined';
  const [metaResponse,dataResponse]=await Promise.all([fetch('./assets/quality/lods.json'),fetch('./assets/quality/lods.bin'+(compressed?'.gz':''))]);
  if(!metaResponse.ok||!dataResponse.ok)return null;
  const [metadata,bytes]=await Promise.all([metaResponse.json(),dataResponse.arrayBuffer()]);
  const buffer=compressed?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes;
  return {get(key,vertexCount){
   const entry=metadata[key];if(!entry)return null;
   const result={};
   for(const quality of ['balanced','low']){
    const {offset,count}=entry[quality];if(offset%4||count%3||offset+count*4>buffer.byteLength)return null;
    const index=new Uint32Array(buffer,offset,count);
    for(const i of index)if(i>=vertexCount)return null;
    result[quality]=index;
   }
   return result;
  }};
 }catch{return null;}
}
