import * as THREE from 'three';
import {TierTextureLoader} from './texture-tiers.js';

// UE3 cooked raw distributions store their min/max bounds in the first two floats.
export function sampleGoalDistribution(d,t=0,random=.5,dimensions=1,fallback=0){
 const a=d?.LookupTable;if(!a||a.length<2+dimensions)return dimensions===1?fallback:Array(dimensions).fill(fallback);
 const uniform=Number(d.Op)===2,stride=dimensions*(uniform?2:1),count=Math.floor((a.length-2)/stride);
 const f=Math.max(0,Math.min(count-1,(t-Number(d.LookupTableStartTime??0))*Number(d.LookupTableTimeScale??0))),i=Math.floor(f),j=Math.min(count-1,i+1),mix=f-i;
 const out=Array.from({length:dimensions},(_,c)=>{const read=k=>{const at=2+k*stride+c;return uniform?a[at]+(a[at+dimensions]-a[at])*random:a[at];};return read(i)+(read(j)-read(i))*mix;});
 return dimensions===1?out[0]:out;
}
const prop=(e,name)=>e.modules.find(m=>m.class===name)?.properties??{};
function velocityIntegral(d,t,random){
 // Trapezoids over the cooked lookup intervals avoid particles reversing as their speed decays.
 const steps=24,step=t/steps,sum=[0,0,0];let previous=sampleGoalDistribution(d,0,random,3,1);
 for(let i=1;i<=steps;i++){const next=sampleGoalDistribution(d,i*step,random,3,1);for(let c=0;c<3;c++)sum[c]+=(previous[c]+next[c])*.5*step;previous=next;}return sum;
}
const world=v=>new THREE.Vector3(v[0],v[2],v[1]).multiplyScalar(.01);
const vertex=`attribute vec3 center;attribute vec2 extent;attribute vec4 tint;attribute vec2 rotationFrame;attribute vec3 travel;varying vec2 vUv;varying vec4 vTint;uniform float aligned;
void main(){vec4 p=modelViewMatrix*vec4(center,1.0);vec2 q=position.xy*extent;float angle=rotationFrame.x;if(aligned>0.5){vec3 v=(viewMatrix*vec4(travel,0.0)).xyz;angle=atan(v.y,v.x)-1.5707963;}float c=cos(angle),s=sin(angle);p.xy+=mat2(c,s,-s,c)*q;gl_Position=projectionMatrix*p;vUv=uv;vTint=tint;vUv+=vec2(0.0);}`;
const fragment=`uniform sampler2D map;uniform float mode;varying vec2 vUv;varying vec4 vTint;
void main(){vec4 tex=texture2D(map,vUv);float a=tex.r;if(mode>0.5&&mode<1.5){a=tex.b;}if(mode>2.5){a=tex.g;}a*=vTint.a;if(a<.002)discard;gl_FragColor=vec4(vTint.rgb,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export async function createGoalExplosion(scene){
 const base='./assets/original/goal-explosion/',source=await (await fetch(base+'source.json')).json(),loader=new TierTextureLoader();
 const [[glow,smoke,lightning,plume],nativeSphere]=await Promise.all([Promise.all(['GradientCircle01.png','Noise_Smoke_02_Pack.png','Lightning_Pack.png','Smoke_Plume_01_Pack.png'].map(n=>loader.loadAsync(base+n))),fetch(base+source.sphereMesh).then(r=>r.json())]);
 // Packed masks are data, not sRGB colours. The blue channel contains smoke density.
 for(const tex of [glow,smoke,lightning,plume])tex.colorSpace=THREE.NoColorSpace;
 const root=new THREE.Group();root.name='Recovered stock goal explosion';root.visible=false;root.userData.source=source.effect;scene.add(root);
 const quad=new THREE.PlaneGeometry(1,1),sphereGeometry=new THREE.BufferGeometry(),layers=[],origin=new THREE.Vector3(),team=new THREE.Color();let time=0,active=false;
 sphereGeometry.setAttribute('position',new THREE.Float32BufferAttribute(nativeSphere.positions,3));sphereGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(nativeSphere.uvs,2));
 const distortion={position:origin,strength:0,radius:0,get active(){return active&&time<.5;},get age(){return time;}};
 for(const e of source.emitters){
  if(e.name==='FlashBig')continue; // Original distortion sphere is exposed to the shared post-process.
  const ribbon=e.type?.class==='ParticleModuleTypeDataRibbon',smoky=e.required.Material.includes('Smoke'),ring=e.type?.class==='ParticleModuleTypeDataMesh';
  const capacity=ribbon?(e.name==='LightTrails'?128:96):Math.min(512,Math.max(1,(e.spawn.BurstList??[]).reduce((s,b)=>s+Number(b.Count),0)+Math.ceil(sampleGoalDistribution(e.spawn.Rate)*Number(e.required.EmitterDuration??0))));
  const shape=ring?sphereGeometry:quad,geo=new THREE.InstancedBufferGeometry();geo.index=shape.index;geo.attributes.position=shape.attributes.position;geo.attributes.uv=shape.attributes.uv;
  for(const [name,size] of [['center',3],['extent',2],['tint',4],['rotationFrame',2],['travel',3]])geo.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({uniforms:{map:{value:ring?lightning:smoky?(ribbon?plume:smoke):glow},mode:{value:smoky?(ribbon?3:1):0},aligned:{value:e.required.ScreenAlignment==='PSA_Velocity'||ribbon?1:0}},vertexShader:ring?`attribute vec3 center;attribute vec2 extent;attribute vec4 tint;varying vec2 vUv;varying vec4 vTint;void main(){vUv=uv;vTint=tint;gl_Position=projectionMatrix*modelViewMatrix*vec4(center+position*extent.x,1.0);}`:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:ring?THREE.DoubleSide:THREE.FrontSide,blending:smoky||e.name==='ShadowSmoke'?THREE.NormalBlending:THREE.AdditiveBlending});
  // Atlas cells are selected per instance in the shader, preserving each puff's frame.
  if(smoky&&!ribbon){material.vertexShader=vertex.replace('vUv+=vec2(0.0);','vUv=(vUv+vec2(mod(rotationFrame.y,2.0),floor(rotationFrame.y/2.0)))*.5;');}
  const mesh=new THREE.Mesh(geo,material);mesh.name='Goal '+e.name;mesh.frustumCulled=false;mesh.renderOrder=smoky?21:22;root.add(mesh);
  layers.push({e,geo,material,mesh,capacity,ribbon,ring,smoky,particles:[],life:prop(e,'ParticleModuleLifetime').LifeTime,size:prop(e,'ParticleModuleSize').StartSize,sizeLife:prop(e,'ParticleModuleSizeMultiplyLife').LifeMultiplier,color:prop(e,'ParticleModuleColorScaleOverLife'),colorLife:prop(e,'ParticleModuleColorOverLife'),velocityLife:prop(e,'ParticleModuleVelocityOverLifetime').VelOverLife});
 }
 function particle(layer,birth,seed){
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},e=layer.e,sphere=prop(e,'ParticleModuleLocationPrimitiveSphere'),z=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-z*z),direction=new THREE.Vector3(Math.cos(a)*r,z,Math.sin(a)*r);
  const radius=sampleGoalDistribution(sphere.StartRadius,birth,random())*.01*(sphere.SurfaceOnly==='True'?1:Math.cbrt(random()));
  const position=direction.clone().multiplyScalar(radius).add(world(sampleGoalDistribution(prop(e,'ParticleModuleLocationWorldOffset').StartLocation,0,random(),3)));
  const velocity=world(sampleGoalDistribution(prop(e,'ParticleModuleVelocity').StartVelocity,0,random(),3));
  if(sphere.Velocity==='True')velocity.addScaledVector(direction,radius*sampleGoalDistribution(sphere.VelocityScale,0,random(),1,1));
  const acceleration=new THREE.Vector3();for(const m of e.modules)if(m.class==='ParticleModuleAcceleration')acceleration.add(world(sampleGoalDistribution(m.properties.Acceleration,0,random(),3)));
  const size=sampleGoalDistribution(layer.size,0,random(),3,64);
  const seedValue=random();if(!layer.integrals)layer.integrals=Array.from({length:33},(_,i)=>velocityIntegral(layer.velocityLife,i/32,.5));
  const integrals=Number(layer.velocityLife?.Op)===2?Array.from({length:33},(_,i)=>velocityIntegral(layer.velocityLife,i/32,seedValue)):layer.integrals;
  return {birth,life:Math.max(.01,sampleGoalDistribution(layer.life,0,random(),1,1)),position,velocity,acceleration,size,rotation:random()*Math.PI*2,rotationRate:sampleGoalDistribution(prop(e,'ParticleModuleRotationRate').StartRotationRate,0,random())*Math.PI*2,frame:Math.floor(random()*4),seed:seedValue,integrals};
 }
 function trigger(goalSign,ballPosition){
  const quality=document.querySelector('#quality-preset')?.value,density=quality==='low'?.4:quality==='balanced'?.7:1;
  time=0;active=true;root.visible=true;origin.copy(ballPosition??new THREE.Vector3(0,3,Math.sign(goalSign||1)*51.3));team.set(goalSign>0?0x389cff:0xffa12b);
  for(const layer of layers){const e=layer.e;layer.particles.length=0;const delay=Number(e.required.EmitterDelay??0);let n=0;
   for(const burst of e.spawn.BurstList??[])for(let i=0;i<Math.ceil(Number(burst.Count)*density)&&n<layer.capacity;i++)layer.particles.push(particle(layer,delay+Number(burst.Time??0),1009*(++n)+source.emitters.indexOf(e)*7919));
   const rate=sampleGoalDistribution(e.spawn.Rate)*density,duration=Number(e.required.EmitterDuration??0);for(let i=0;i<rate*duration&&n<layer.capacity;i++)layer.particles.push(particle(layer,delay+(i+.5)/rate,1009*(++n)+source.emitters.indexOf(e)*7919));
  }
  // Ribbon topology/mesh shader remain translations: use short pooled segments following parent trajectories.
  for(const layer of layers.filter(l=>l.ribbon)){const parent=layers.find(l=>l.e.name===prop(layer.e,'ParticleModuleTrailSource').SourceName);if(!parent)continue;
   const per=Math.max(1,Math.floor(layer.capacity*density/parent.particles.length));for(const p of parent.particles)for(let i=0;i<per;i++){const birth=p.birth+p.life*(i+.5)/per,q=particle(layer,birth,layer.particles.length*7919+17);q.position.copy(p.position).addScaledVector(p.velocity,birth-p.birth);q.velocity.copy(p.velocity).multiplyScalar(.02);q.size[1]=Math.max(q.size[1],p.velocity.length()*100*p.life/per);layer.particles.push(q);}
  }
  update(0);
 }
 function update(dt){
  if(!active)return;time+=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.25));let alive=0;
  for(const layer of layers){let count=0;const at=layer.geo.attributes;
   for(const p of layer.particles){const age=time-p.birth;if(age<0){alive++;continue;}if(age>=p.life)continue;alive++;const t=age/p.life,scale=sampleGoalDistribution(layer.sizeLife,t,p.seed,3,1),index=Math.min(31,Math.floor(t*32)),f=t*32-index,vscale=p.integrals[index].map((v,c)=>(v+(p.integrals[index+1][c]-v)*f)*p.life);
    const x=p.position.x+p.velocity.x*vscale[0]+p.acceleration.x*age*age*.5,y=p.position.y+p.velocity.y*vscale[2]+p.acceleration.y*age*age*.5,z=p.position.z+p.velocity.z*vscale[1]+p.acceleration.z*age*age*.5;
    at.center.setXYZ(count,origin.x+x,origin.y+y,origin.z+z);
    let sx=p.size[0]*scale[0]*.01,sy=(p.size[1]||p.size[0])* (p.size[1]?scale[1]:scale[0])*.01;if(!layer.e.required.ScreenAlignment&&!layer.ribbon)sy=sx;if(layer.ring)sx=sy=p.size[0]*scale[0];
    at.extent.setXY(count,Math.max(.005,Math.abs(sx)),Math.max(.005,Math.abs(sy)));
    const colors=sampleGoalDistribution(layer.color.ColorScaleOverLife,t,p.seed,3,1),alpha=sampleGoalDistribution(layer.color.AlphaScaleOverLife??layer.colorLife.AlphaOverLife,t,p.seed,1,1),shadow=layer.e.name==='ShadowSmoke';
    at.tint.setXYZW(count,shadow?.02:team.r*colors[0],shadow?.025:team.g*colors[1],shadow?.03:team.b*colors[2],Math.max(0,alpha)*(shadow?.3:1));
    at.rotationFrame.setXY(count,p.rotation+age*p.rotationRate,p.frame);at.travel.setXYZ(count,p.velocity.x,p.velocity.y,p.velocity.z);count++;
   }
   layer.geo.instanceCount=count;layer.mesh.visible=count>0;for(const a of Object.values(at))if(a.isInstancedBufferAttribute)a.needsUpdate=true;
  }
  distortion.radius=30.72*(1-Math.min(1,time/.5));distortion.strength=time<.5?(1-time/.5)*.025:0;
  if(!alive||time>7)reset();
 }
 function reset(){active=false;root.visible=false;distortion.strength=0;for(const l of layers){l.geo.instanceCount=0;l.particles.length=0;}}
 function dispose(){reset();scene.remove(root);for(const l of layers){l.geo.dispose();l.material.dispose();}quad.dispose();sphereGeometry.dispose();glow.dispose();smoke.dispose();lightning.dispose();plume.dispose();}
 return {trigger,update,reset,dispose,distortion,get active(){return active;},source};
}


