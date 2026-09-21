import {createMobileMaterials} from './mobile-materials.js';
import {setTextureQuality} from './texture-tiers.js';
import {geometryLODKey,loadGeometryLODs} from './quality-lod-cache.js';
import * as THREE from 'three';

export const QUALITY_PRESETS=Object.freeze({
 realistic:{label:'Realistic',description:'Full geometry; compact 512px textures.',ratio:1},
 balanced:{label:'Balanced',description:'Compact textures, lighter scenery and efficient fog.',ratio:.6},
 low:{label:'Low',description:'Compact textures and lean scenery for weaker GPUs.',ratio:.3},
});

// Keep the same field material, baked lighting, team masks and reflection math.
// Only reuse the existing central noise sample for subpixel grass layers.
export function fieldDetailShader(code,quality){
 if(quality==='realistic')return code;
 const first='texture2D(field_t3,(r1.zwzz).xy)';
 code=code.replace('  r3.x=','  vec4 parkGrassNoise='+first+';\n  r3.x=');
 for(const sample of [first,'texture2D(field_t3,(r7.xyxx).xy)','texture2D(field_t3,(r7.zwzz).xy)'])code=code.replaceAll(sample,'parkGrassNoise');
 code=code.replace('vec4 parkGrassNoise=parkGrassNoise;','vec4 parkGrassNoise='+first+';');
 return code;
}

export function lodLimits(mesh){
 const names=(mesh.userData.sourceComponents??[]).map(s=>s.mesh??'').join(' ');
 const m=mesh.material;
 // Transparent boundaries, cutout leaves, flags and all dynamic vehicles
 // retain their authored topology; removing cards would punch visible holes.
 if(!names||m.transparent||m.alphaTest>0||/foliage|flag|net/.test(m.userData.recoveredSurface??''))return null;
 if(/Mountain|Hills/.test(names))return [.4,1.5];
 if(mesh.parent?.name.endsWith('scenery'))return [.06,.22];
 return [.008,.025];
}

export async function createQualityPresets(scene,ground,canvas,{onTextureQuality=async()=>{}}={}){
 const select=document.querySelector('#quality-preset'),description=document.querySelector('#quality-description');
 const requested=new URLSearchParams(location.search).get('quality');
 let saved;try{saved=localStorage.getItem('beckwith.quality');}catch{}
 let current=QUALITY_PRESETS[requested]?requested:QUALITY_PRESETS[saved]?saved:'low';
 const meshes=[],normalMaps=[],fieldOriginal=ground.material.onBeforeCompile,fieldCache=ground.material.customProgramCacheKey;
 // The outer compact-uniform wrapper must run after the material has injected
 // its code. This wrapper keeps both program variants and uniforms live.
 ground.material.onBeforeCompile=function(shader,renderer){fieldOriginal.call(this,shader,renderer);shader.fragmentShader=fieldDetailShader(shader.fragmentShader,current);};
 ground.material.customProgramCacheKey=()=>fieldCache.call(ground.material)+'|quality-'+current;
 const mobileMaterials=createMobileMaterials(scene,ground,canvas);
 scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const limits=lodLimits(mesh);if(limits)meshes.push({mesh,limits,full:mesh.geometry.index,levels:{}});
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(material.normalMap&&!normalMaps.some(n=>n.material===material))normalMaps.push({material,map:material.normalMap,distant:/Mountain|Hills|SideWalk|GrassAndBush|RiverStrip/.test(material.name)});
  }
 });
 let prepared=false;
 function setQuality(value,{save=true}={}){
  current=QUALITY_PRESETS[value]?value:'realistic';select.value=current;
  description.textContent=QUALITY_PRESETS[current].description+(prepared?'':' Preparing geometry presets…');
  let fullTriangles=0,selectedTriangles=0;
  for(const item of meshes){
   const g=item.mesh.geometry,index=item.levels[current]??item.full;
   if(g.index!==index)g.setIndex(index);
   fullTriangles+=(item.full?.count??g.attributes.position.count)/3;
   selectedTriangles+=(index?.count??g.attributes.position.count)/3;
  }
  for(const entry of normalMaps){
   const next=current==='low'||current==='balanced'&&entry.distant?null:entry.map;
   if(entry.material.normalMap!==next){entry.material.normalMap=next;entry.material.needsUpdate=true;}
  }
  mobileMaterials.setQuality(current);
  ground.material.needsUpdate=true;
  canvas.dataset.quality=current;
  canvas.dataset.qualityStats=JSON.stringify({prepared,fullTriangles,selectedTriangles,savedTriangles:fullTriangles-selectedTriangles,scaleIndependent:true});
  if(save)try{localStorage.setItem('beckwith.quality',current);}catch{}
  const selected=current;
  description.textContent+=' Loading textures…';
  return setTextureQuality(selected,canvas).then(async applied=>{if(applied&&current===selected){await onTextureQuality(selected);if(current===selected)description.textContent=QUALITY_PRESETS[current].description+(prepared?'':' Preparing geometry presets…');}}).catch(error=>{if(current===selected)description.textContent='Texture loading failed: '+error.message;throw error;});
 }
 select.addEventListener('change',e=>{setQuality(e.target.value).catch(console.error);});select.disabled=false;await setQuality(current,{save:false});
 const cache=await loadGeometryLODs();let cacheHits=0,worker=null;
 function simplify(data){return new Promise((resolve,reject)=>{
  worker??=new Worker(new URL('./quality-lod-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=e=>e.data.error?reject(new Error(e.data.error)):resolve(e.data);
  worker.onerror=e=>reject(new Error(e.message));
  worker.postMessage(data,[data.indices.buffer,data.positions.buffer,data.values.buffer]);
 });}
 let processed=0;
 try{
 for(const item of meshes){
  const g=item.mesh.geometry,p=g.attributes.position;
  if(!item.full||item.full.count<180)continue;
  const cached=cache?.get(geometryLODKey(g,item.limits),p.count);
  if(cached){
   for(const level of ['balanced','low'])if(cached[level].length<item.full.count)item.levels[level]=new THREE.BufferAttribute(p.count<=65535?new Uint16Array(cached[level]):cached[level],1);
   cacheHits++;continue;
  }
  // Attribute-aware collapse preserves texture seams, normals and the actual
  // source lightmap coefficients. No new vertex colors or lighting are made.
  const attrs=['normal','uv','sourceLightmapUV','sourceBakedLight0','sourceBakedLight1','sourceColor']
   .map(name=>[name,g.attributes[name]]).filter(([,a])=>a);
  const stride=attrs.reduce((sum,[name,a])=>sum+Math.min(a.itemSize,name==='sourceColor'?3:4),0);
  const values=new Float32Array(p.count*stride),weights=[];
  let offset=0;
  for(const [name,a]of attrs){const size=Math.min(a.itemSize,name==='sourceColor'?3:4);
   const weight=name==='normal'?.1:name.startsWith('sourceBaked')?.15:.5;
   for(let c=0;c<size;c++){weights.push(weight);for(let v=0;v<p.count;v++)values[v*stride+offset+c]=a.getComponent(v,c);}
   offset+=size;
  }
  const indices=new Uint32Array(item.full.array);
  const results=await simplify({indices,positions:p.array.slice(),values,stride,weights,limits:item.limits});
  for(const level of ['balanced','low']){
   const result=results[level];
   if(result.length<item.full.count)item.levels[level]=new THREE.BufferAttribute(p.count<=65535?new Uint16Array(result):result,1);
  }
  // Share render time with loading/UI; simplification happens only once.
  if(++processed%4===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 }finally{worker?.terminate();}
 canvas.dataset.lodPreparation=JSON.stringify({cacheHits,computed:processed});
 prepared=true;await setQuality(current,{save:false});
 return {setQuality,get current(){return current;}};
}
