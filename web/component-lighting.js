import * as THREE from 'three';
import {decodeVertexLightmap} from './native-lightmap.js';
let ready;
export function componentLighting(){return ready??=(async()=>{
 const [metadata,bytes,mappingBytes]=await Promise.all([
  fetch('./assets/original/component-lighting.json').then(r=>r.json()),
  fetch('./assets/original/component-lighting.bin').then(r=>r.arrayBuffer()),
  fetch('./assets/original/native-vertex-mapping.bin').then(r=>r.arrayBuffer())
 ]);
 function attach(mesh,instance){
  const binding=metadata.components[instance.name];if(!binding)return;
  mesh.userData.sourceLighting=binding;
  const mapping=metadata.vertexMappings[instance.mesh];
  let geometry=mesh.geometry,cloned=false;
  const attribute=(name,array,size,normalized=false)=>{if(!cloned){geometry=geometry.clone();mesh.geometry=geometry;cloned=true;}geometry.setAttribute(name,new THREE.BufferAttribute(array,size,normalized));};
  if(mapping){
   const vertexCount=mapping.parts.reduce((n,p)=>n+p.count,0);
   if(vertexCount!==geometry.attributes.position.count)throw new Error(`Native vertex mapping count mismatch: ${instance.mesh}`);
   const indices=new Uint32Array(vertexCount);let cursor=0;
   for(const part of mapping.parts){indices.set(new Uint32Array(mappingBytes,part.offset,part.count),cursor);cursor+=part.count;}
   const expand=(source,byteWithinVertex)=>{
    if(source.count!==mapping.nativeVertexCount)throw new Error(`Native component buffer count mismatch: ${instance.name}`);
    const raw=new Uint8Array(bytes,source.offset,source.byteLength),out=new Uint8Array(vertexCount*4);
    for(let i=0;i<vertexCount;i++){const off=indices[i]*source.stride+byteWithinVertex;out.set(raw.subarray(off,off+4),i*4);}return out;
   };
   // Dormant attributes retain source inputs. They deliberately do not enable
   // Three's stock vertex-color multiplication or substitute a lighting model.
   if(binding.vertexColors)attribute('sourceColor',expand(binding.vertexColors,0),4,true);
   if(binding.vertexLightmap){
    attribute('sourceVertexLight0',expand(binding.vertexLightmap,0),4,true);attribute('sourceVertexLight1',expand(binding.vertexLightmap,4),4,true);
    const raw=new Uint8Array(bytes,binding.vertexLightmap.offset,binding.vertexLightmap.byteLength);
    for(let coefficient=0;coefficient<2;coefficient++){
     const decoded=new Float32Array(vertexCount*3),scale=binding.coefficientScales[coefficient];
     for(let i=0;i<vertexCount;i++)decoded.set(decodeVertexLightmap(raw,indices[i]*8+coefficient*4,scale),i*3);
     attribute(`sourceBakedLight${coefficient}`,decoded,3);
    }
   }
  }
  if(binding.lightMapType===2){
   const channel=binding.lightMapCoordinateIndex,uv=geometry.getAttribute(channel===0?'uv':`uv${channel}`);
   if(!uv)throw new Error(`Missing original lightmap UV${channel}: ${instance.mesh}`);
   const out=new Float32Array(uv.count*2),scale=binding.coordinateScale,bias=binding.coordinateBias;
   for(let i=0;i<uv.count;i++){out[i*2]=uv.getX(i)*scale[0]+bias[0];out[i*2+1]=uv.getY(i)*scale[1]+bias[1];}
   attribute('sourceLightmapUV',out,2);
  }
 }
 return {attach,metadata};
})();}
