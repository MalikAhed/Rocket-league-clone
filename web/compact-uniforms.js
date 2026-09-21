// Preserve shader math, replacing sparse register arrays with the entries used.
// Individual uniforms also let Three cache unchanged values between draws.
export const uniformSavings={programs:0,arraySlots:0,usedSlots:0};
export function compactShaderUniforms(shader){
 const stages=['vertexShader','fragmentShader'];
 const declarations=new Map();
 for(const stage of stages)for(const m of shader[stage].matchAll(/uniform\s+vec4\s+(\w+)\s*\[\s*(\d+)\s*\]\s*;/g))declarations.set(m[1],Number(m[2]));
 let arrays=0,used=0;
 for(const [name,count]of declarations){
  const uniform=shader.uniforms[name];if(!Array.isArray(uniform?.value)||!uniform.value.every(v=>v?.isVector4))continue;
  const declaration=new RegExp(`uniform\\s+vec4\\s+${name}\\s*\\[\\s*\\d+\\s*\\]\\s*;`,'g');
  const access=new RegExp(`\\b${name}\\s*\\[\\s*(\\d+)\\s*\\]`,'g');
  const bodies=stages.map(stage=>shader[stage].replace(declaration,''));
  // Skip dynamic indexing or arrays passed to functions; retain their semantics.
  if(bodies.some(body=>new RegExp(`\\b${name}\\b`).test(body.replace(access,''))))continue;
  const slots=[...new Set(bodies.flatMap(body=>[...body.matchAll(access)].map(m=>Number(m[1]))))].sort((a,b)=>a-b);
  if(slots.some(i=>i>=uniform.value.length))continue;
  for(const i of slots)shader.uniforms[`${name}_slot_${i}`]={get value(){return uniform.value[i];}};
  for(const stage of stages){
   const localSlots=[...new Set([...shader[stage].replace(declaration,'').matchAll(access)].map(m=>Number(m[1])))];
   shader[stage]=shader[stage].replace(declaration,localSlots.map(i=>`uniform vec4 ${name}_slot_${i};`).join('\n')).replace(access,(_,i)=>`${name}_slot_${Number(i)}`);
  }
  arrays+=count;used+=slots.length;
 }
 return {arraySlots:arrays,usedSlots:used};
}
export function optimizeMaterialUniforms(material){
 if(material.userData.compactUniforms)return;
 material.userData.compactUniforms=true;
 const before=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  before.call(this,shader,renderer);
  const savings=compactShaderUniforms(shader);
  if(savings.arraySlots){uniformSavings.programs++;uniformSavings.arraySlots+=savings.arraySlots;uniformSavings.usedSlots+=savings.usedSlots;
   const canvas=document.querySelector('#scene');if(canvas)canvas.dataset.uniformSavings=JSON.stringify(uniformSavings);
  }
 };
 material.customProgramCacheKey=()=>cacheKey+'|compact-registers-v1';
 material.needsUpdate=true;
}
export function optimizeSceneUniforms(scene){
 scene.traverse(node=>{if(node.material)for(const material of Array.isArray(node.material)?node.material:[node.material])optimizeMaterialUniforms(material);});
}
