import {parkFogGLSL} from './park-height-fog.js';

// The original uniform values remain in their objects. Only known immutable
// environment registers become constants in the reduced shader permutations.
export function specializeEnvironment(shader,kind){
 const arrays=['surfaceCB','surfaceMaterialCB'];let count=0;
 for(const name of arrays){
  const slots=shader.uniforms[name]?.value;
  const indices=slots?Array.from({length:slots.length},(_,i)=>i):[...new Set([...shader.vertexShader.matchAll(new RegExp(name+'_slot_(\\d+)','g')),...shader.fragmentShader.matchAll(new RegExp(name+'_slot_(\\d+)','g'))].map(m=>Number(m[1])))];
  for(const i of indices){
   if(name==='surfaceCB'&&([26,27].includes(i)||(i===59&&['flag','net'].includes(kind))))continue;
   const value=slots?.[i]??shader.uniforms[`${name}_slot_${i}`]?.value;
   if(!value?.isVector4)continue;
   const values=value.toArray();if(!values.every(Number.isFinite))continue;
   const literal='vec4('+values.map(n=>{const s=String(Math.fround(n));return /[.eE]/.test(s)?s:s+'.0';}).join(',')+')';
   for(const stage of ['vertexShader','fragmentShader']){
    const declaration=new RegExp('uniform\\s+vec4\\s+'+name+'_slot_'+i+'\\s*;','g');
    shader[stage]=shader[stage].replace(declaration,()=>{count++;return `const vec4 ${name}_slot_${i}=${literal};`;});
    // Also support the diagnostic URL that disables uniform compaction.
    if(slots)shader[stage]=shader[stage].replace(new RegExp('\\b'+name+'\\[\\s*'+i+'\\s*\\]','g'),literal);
   }
  }
 }
 return count;
}

export function interpolateHeightFog(shader){
 const signature='vec3 applyParkHeightFog(vec3 colour)';
 if(!shader.fragmentShader.includes(signature)||!shader.vertexShader.includes('parkWorldPosition='))return false;
 const varying='varying vec4 qualityVertexFog;\n';
 shader.fragmentShader=varying+shader.fragmentShader.replace(/vec3 applyParkHeightFog\(vec3 colour\)\s*\{[\s\S]*?\n\}/,
  'vec3 applyParkHeightFog(vec3 colour) {return colour*qualityVertexFog.w+qualityVertexFog.xyz;}');
 if(!shader.vertexShader.includes('vec4 parkHeightFogFactors')){
  shader.vertexShader=shader.vertexShader.replace(/varying vec3 parkWorldPosition;\s*/, '');
  shader.vertexShader=parkFogGLSL+shader.vertexShader;
 }
 shader.vertexShader=varying+shader.vertexShader.replace(/parkWorldPosition=([^;]+);/,
  '$&qualityVertexFog=parkHeightFogFactors(parkWorldPosition);');
 return true;
}

export function createMobileMaterials(scene,ground,canvas){
 let quality='realistic';const entries=[],seen=new Set(),updateSeen=new Set();
 scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material.userData.nativeScalars&&!updateSeen.has(material)){
   updateSeen.add(material);const update=material.onBeforeRender;let frame=-1,lastRenderer,lastCamera;
   material.onBeforeRender=function(renderer,world,camera,...rest){
    if(quality==='realistic'||frame!==renderer.info.render.frame||lastRenderer!==renderer||lastCamera!==camera){
     update.call(this,renderer,world,camera,...rest);frame=renderer.info.render.frame;lastRenderer=renderer;lastCamera=camera;
    }
   };
  }
  const environment=mesh===ground||Boolean(mesh.userData.sourceComponents);
  if(!environment)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(seen.has(material))continue;seen.add(material);
   const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material),single=material.forceSinglePass;
   const fogAllowed=mesh===ground||material.userData.recoveredSurface==='foliage'||mesh.parent?.name.endsWith('arena');
   const entry={material,single};entries.push(entry);
   material.onBeforeCompile=function(shader,renderer){
    before.call(this,shader,renderer);
    if(quality==='realistic')return;
    specializeEnvironment(shader,material.userData.recoveredSurface);
    // Same authored height integral, fog colors and density, evaluated at
    // mesh vertices and interpolated instead of recomputed for every pixel.
    if(fogAllowed&&!material.transparent)interpolateHeightFog(shader);
   };
   material.customProgramCacheKey=()=>key()+(quality==='realistic'?'':'|mobile-materials-v1-'+quality);
  }
 });
 return {setQuality(value){
  const changed=quality!==value;quality=value;
  if(canvas.parentElement)canvas.parentElement.dataset.quality=quality;
  for(const {material,single}of entries){material.forceSinglePass=quality==='realistic'?single:true;if(changed)material.needsUpdate=true;}
  canvas.dataset.mobileMaterials=JSON.stringify({quality,materials:entries.length,vertexFog:quality!=='realistic',singlePassTransparency:quality!=='realistic'});
 }};
}
