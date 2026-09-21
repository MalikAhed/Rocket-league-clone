import * as THREE from 'three';
import {exactIndex} from './exact-index.js';
import {batchAdvertMaterial} from './advert-batching.js';
import {isCameraOccluder} from './camera-occluders.js';
const optimize=!new URLSearchParams(location.search).has('baselinePerformance');
import {mergeGeometries} from './utils/BufferGeometryUtils.js';
export function cheapMaterials(root){
 const cache=new Map();root.traverse(mesh=>{if(!mesh.isMesh)return;
  const convert=source=>{if(!source.isMeshStandardMaterial)return source;if(cache.has(source))return cache.get(source);
   const m=new THREE.MeshLambertMaterial({color:source.color,map:source.map,emissive:source.emissive,emissiveMap:source.emissiveMap,emissiveIntensity:source.emissiveIntensity,side:source.side,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,depthWrite:source.depthWrite});cache.set(source,m);return m;};
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(convert):convert(mesh.material);mesh.castShadow=false;mesh.receiveShadow=false;
 });
}
export function batchExterior(root){
 root.updateMatrixWorld(true);const buckets=new Map(),oldGeometries=new Set();
 for(const mesh of root.children){if(!mesh.isMesh)continue;oldGeometries.add(mesh.geometry);
  const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
  const groups=source.groups.length?source.groups:[{start:0,count:source.attributes.position.count,materialIndex:0}];
  for(const group of groups){let material=Array.isArray(mesh.material)?mesh.material[group.materialIndex]:mesh.material;if(!material)continue;const g=new THREE.BufferGeometry();
   for(const [name,a] of Object.entries(source.attributes)){g.setAttribute(name,new THREE.BufferAttribute(a.array.slice(group.start*a.itemSize,(group.start+group.count)*a.itemSize),a.itemSize,a.normalized));}
   material=batchAdvertMaterial(material,g);
   g.applyMatrix4(mesh.matrixWorld);
   // transformDirection transforms tangent.xyz but leaves tangent.w alone.
   // Reflections reverse cross(N,T), so restore the bitangent sign as well.
   if(g.attributes.tangent&&mesh.matrixWorld.determinant()<0){const tangent=g.attributes.tangent;for(let v=0;v<tangent.count;v++)tangent.setW(v,-tangent.getW(v));}
   // Baked identity meshes lose WebGLRenderer's determinant-based winding
   // correction. Include the exported basis, which is left-handed for Park_P.
   if(mesh.matrixWorld.determinant()*(mesh.userData.sourceWinding??1)<0){
    for(const a of Object.values(g.attributes)){for(let v=0;v<a.count;v+=3){for(let c=0;c<a.itemSize;c++){const p=(v+1)*a.itemSize+c,q=(v+2)*a.itemSize+c,t=a.array[p];a.array[p]=a.array[q];a.array[q]=t;}}}
   }
   const casts=mesh.castShadow&&material.userData.recoveredSurface!=='net'&&!material.userData.nativeTranslucent;
   // Keep translucent source components separate so the renderer can sort
   // them by depth within their original TranslucencySortPriority.
   const cameraOccluder=isCameraOccluder(mesh.name);
   const key=[material.uuid,material.transparent?mesh.uuid:'',cameraOccluder,casts,mesh.receiveShadow,mesh.renderOrder,Object.keys(g.attributes).join(',')].join('|');
   let b=buckets.get(key);if(!b){b={material,parts:[],sources:[],vertexCount:0,castShadow:casts,receiveShadow:mesh.receiveShadow,renderOrder:mesh.renderOrder,cameraOccluder};buckets.set(key,b);}b.sources.push({component:mesh.userData.sourceComponent,mesh:mesh.name,firstVertex:b.vertexCount,vertexCount:g.attributes.position.count,lighting:mesh.userData.sourceLighting});b.vertexCount+=g.attributes.position.count;b.parts.push(g);
  }
  if(source!==mesh.geometry)source.dispose();
 }
 const output=new THREE.Group();output.name='Batched original exterior';
 for(const {material,parts,sources,castShadow,receiveShadow,renderOrder,cameraOccluder}of buckets.values()){const g=mergeGeometries(parts,false);if(optimize)exactIndex(g);g.computeBoundingSphere();const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=receiveShadow;mesh.castShadow=castShadow&&material.visible;mesh.renderOrder=renderOrder;mesh.userData.sourceComponents=sources;mesh.userData.cameraOccluder=cameraOccluder;if(optimize){mesh.updateMatrix();mesh.matrixAutoUpdate=false;mesh.matrixWorldAutoUpdate=false;mesh.matrixWorld.copy(mesh.matrix);}
 output.add(mesh);parts.forEach(p=>p.dispose());}
 oldGeometries.forEach(g=>g.dispose());
 const totals={beforeVertices:0,afterVertices:0,beforeBytes:0,afterBytes:0,verifiedBatches:0};
 output.traverse(n=>{if(n.geometry?.userData.exactIndex){for(const k of ['beforeVertices','afterVertices','beforeBytes','afterBytes'])totals[k]+=n.geometry.userData.exactIndex[k];if(n.geometry.userData.exactIndexVerified)totals.verifiedBatches++;}});
 const canvas=document.querySelector('#scene');if(canvas){const previous=JSON.parse(canvas.dataset.geometrySavings||'{}');for(const k in totals)totals[k]+=previous[k]||0;canvas.dataset.geometrySavings=JSON.stringify(totals);}
 return output;
}
