import * as THREE from 'three';

// Match the complete binary vertex, never just position or rounded normals.
// Index order remains identical, including transparent triangle order.
export function exactIndex(geometry) {
 if(geometry.index)return geometry;
 const attributes=Object.entries(geometry.attributes);
 const words=attributes.map(([,a])=>a.array.BYTES_PER_ELEMENT===4
  ?new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length):a.array);
 const count=geometry.attributes.position.count,unique=[],indices=new Uint32Array(count),seen=new Map();
 for(let v=0;v<count;v++){
  let key='';
  for(let j=0;j<attributes.length;j++){
   const size=attributes[j][1].itemSize,values=words[j];
   for(let c=0;c<size;c++)key+=values[v*size+c]+',';
  }
  let index=seen.get(key);
  if(index===undefined){index=unique.length;seen.set(key,index);unique.push(v);}
  indices[v]=index;
 }
 const before=attributes.reduce((n,[,a])=>n+a.array.byteLength,0);
 const indexBytes=count*(unique.length<=65535?2:4);
 const after=before*unique.length/count+indexBytes;
 geometry.userData.exactIndex={beforeVertices:count,afterVertices:count,beforeBytes:before,afterBytes:before};
 if(after>=before)return geometry;
 for(const [name,a]of attributes){
  const array=new a.array.constructor(unique.length*a.itemSize);
  unique.forEach((v,i)=>array.set(a.array.subarray(v*a.itemSize,(v+1)*a.itemSize),i*a.itemSize));
  const replacement=new THREE.BufferAttribute(array,a.itemSize,a.normalized);
  replacement.name=a.name;replacement.gpuType=a.gpuType;geometry.setAttribute(name,replacement);
 }
 geometry.setIndex(new THREE.BufferAttribute(unique.length<=65535?new Uint16Array(indices):indices,1));
 if(new URLSearchParams(location.search).has('verifyGeometry')){
  // Verify every original attribute bit through the new index, on real assets.
  for(const [name,old]of attributes){
   const a=geometry.attributes[name],stride=old.itemSize*old.array.BYTES_PER_ELEMENT;
   const src=new Uint8Array(old.array.buffer,old.array.byteOffset,old.array.byteLength);
   const dst=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);
   for(let v=0;v<count;v++)for(let b=0;b<stride;b++)
    if(src[v*stride+b]!==dst[indices[v]*stride+b])throw new Error(`Vertex data changed: ${name} ${v}`);
  }
  geometry.userData.exactIndexVerified=true;
 }
 geometry.userData.exactIndex={beforeVertices:count,afterVertices:unique.length,beforeBytes:before,afterBytes:after};
 return geometry;
}
