import {TierTextureLoader} from './texture-tiers.js';
import * as THREE from 'three';

// Gold Rush / Alpha Reward: original Fennec cone geometry, original texture
// dependencies, and active Cascade distributions. Material equations and FX
// attachment scheduling are WebGL adaptations, not native UE3 execution.
const BASE='./assets/original/alpha-boost/';
function sample(d,t,component=0,stride=1){
 const a=d.LookupTable;if(!a?.length)return 1;
 const count=(a.length-2)/stride,u=THREE.MathUtils.clamp((t-(d.LookupTableStartTime??0))*(d.LookupTableTimeScale??0),0,count-1);
 const i=Math.floor(u),j=Math.min(i+1,count-1);return THREE.MathUtils.lerp(a[2+i*stride+component],a[2+j*stride+component],u-i);
}
export async function createOriginalBoost(){
 const loader=new TierTextureLoader(),files=['Noise_Smoke_03_Pack','Noise_Cones01_D','Cloud_T','Dust_T','Water_02_N','ParticleSheet_T','CloudyFlare'];
 const [source,modules,attachments,...maps]=await Promise.all([fetch(BASE+'fennec-cone.json').then(r=>{if(!r.ok)throw Error('Alpha cone '+r.status);return r.json();}),fetch(BASE+'cascade.json').then(r=>{if(!r.ok)throw Error('Alpha cascade '+r.status);return r.json();}),fetch(BASE+'attachments.json').then(r=>{if(!r.ok)throw Error('Alpha attachments '+r.status);return r.json();}),...files.map(n=>loader.loadAsync(BASE+n+'.png'))]);
 maps.forEach((m,i)=>{m.colorSpace=THREE.NoColorSpace;m.wrapS=m.wrapT=(i===2||i===6)?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;m.anisotropy=1;});
 const object=new THREE.Group();object.name='Original Gold Rush / Alpha Reward boost';
 object.userData.provenance={package:'Boost_AlphaReward_SF.upk',effect:'Boost_AlphaReward.FX.FXActor',cone:source.source,material:'Boost_AlphaReward.Materials.AlphaReward_MIC',particles:'Boost_AlphaReward.Materials.LiquidGold_02_MAT',exactEngineEffect:false};
 const sockets=attachments.sockets.map(p=>new THREE.Vector3().fromArray(p));const rocketSocket=new THREE.Vector3().fromArray(attachments.rocketBoost);const overrides=Object.fromEntries(attachments.activeTraits.map(p=>[p.Name,p]));
 const time={value:0},strength={value:0};const qualityControl=document.querySelector('#quality-preset');
 const coneGeometry=new THREE.BufferGeometry();coneGeometry.setAttribute('position',new THREE.Float32BufferAttribute(source.positions,3));coneGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(source.uv,2));coneGeometry.setIndex(source.rearExhaustIndices??source.indices);coneGeometry.computeVertexNormals();
 const coneMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending,
  uniforms:{time,strength,water:{value:maps[4]},sheet:{value:maps[5]},gold:{value:new THREE.Vector3(1.5,.8,.2)}},
  vertexShader:`varying vec2 vUv;varying float vAlong;varying vec3 vNormal,vEye;uniform float time;uniform float strength;
   void main(){vUv=uv;vec3 p=position;vAlong=1.-uv.y;
    // BoostConeMesh is attached to chassis_jnt at identity. Preserve every
    // native vertex, including the shorter underside nozzle shells.
    vec4 mv=modelViewMatrix*vec4(p,1.);vNormal=normalize(normalMatrix*normal);vEye=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec2 vUv;varying float vAlong;varying vec3 vNormal,vEye;uniform sampler2D water,sheet;uniform vec3 gold;uniform float time,strength;
   void main(){vec2 flow=texture2D(water,vUv*2.+vec2(-time*1.5,time*.15)).rg*2.-1.;
    float noise=texture2D(sheet,vUv*2.+flow*.06+vec2(0.,-time)).r;
    float edge=pow(1.-abs(dot(normalize(vNormal),normalize(vEye))),3.);
    float fade=clamp(pow(1.-vAlong,3.)*12.,0.,1.);float a=fade*(.45+noise*.55)*strength;
    vec3 c=gold*mix(3.,6.,step(.5,vUv.x))*(0.6+noise*.4);gl_FragColor=vec4(c,a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const cone=new THREE.Mesh(coneGeometry,coneMaterial);cone.name='Original Fennec boost cone';object.add(cone);
 const max=384,quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=quad.index;geometry.attributes.position=quad.attributes.position;geometry.attributes.uv=quad.attributes.uv;
 const positions=new Float32Array(max*4),life=new Float32Array(max*4),tints=new Float32Array(max*3);
 geometry.setAttribute('particle',new THREE.InstancedBufferAttribute(positions,4).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('life',new THREE.InstancedBufferAttribute(life,4).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('tint',new THREE.InstancedBufferAttribute(tints,3).setUsage(THREE.DynamicDrawUsage));geometry.instanceCount=0;
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.NormalBlending,
  uniforms:{time,noiseMap:{value:maps[0]},coneMap:{value:maps[1]},cloudMap:{value:maps[2]},dustMap:{value:maps[3]}},
  vertexShader:`attribute vec4 particle,life;attribute vec3 tint;varying vec2 vUv;varying vec4 vLife;varying vec3 vTint;
   void main(){vUv=uv;vLife=life;vTint=tint;vec4 center=viewMatrix*vec4(particle.xyz,1.);center.xy+=position.xy*particle.w;gl_Position=projectionMatrix*center;}`,
  fragmentShader:`uniform sampler2D noiseMap,coneMap,cloudMap,dustMap;uniform float time;varying vec2 vUv;varying vec4 vLife;varying vec3 vTint;
   void main(){vec2 q=vUv;float cloud=texture2D(cloudMap,q).r;
    vec3 n=texture2D(noiseMap,q*1.3+vec2(vLife.z,-vLife.x*.18)).rgb;
    float cones=texture2D(coneMap,q+vec2(vLife.z*.17,vLife.x*.1)).r;
    float dust=texture2D(dustMap,q).r;
    float shape=cloud*smoothstep(.1,.7,n.r*.5+cones*.35+dust*.15);
    float a=shape*vLife.y;if(a<.003)discard;
    gl_FragColor=vec4(vTint*(.6+1.4*n.g),a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const particles=new THREE.Mesh(geometry,material);particles.name='Gold Rush world trail and local exhaust';particles.frustumCulled=false;object.add(particles);
 const flareMaterial=new THREE.SpriteMaterial({map:maps[6],color:new THREE.Color(4.5,.9375,.15),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0});
 const flare=new THREE.Sprite(flareMaterial);flare.name='Original Alpha boost CloudyFlare';flare.position.copy(rocketSocket);flare.scale.set(80,80,1);object.add(flare);
 const flareEye=new THREE.Vector3(),flareAxis=new THREE.Vector3();
 flare.onBeforeRender=(renderer,scene,camera)=>{flare.getWorldPosition(flareEye);flareEye.sub(camera.position).normalize();flareAxis.set(-1,0,0).transformDirection(object.matrixWorld);const facing=-flareEye.dot(flareAxis);flareMaterial.opacity=strength.value*.25*THREE.MathUtils.smoothstep(facing,-.985,.766);};
 const pool=Array.from({length:max},()=>({p:new THREE.Vector3(),local:false,age:2,seed:0,size:0,vy:0,vx:0,nozzle:0}));
 const center=new THREE.Vector3(),previous=new THREE.Vector3(),offset=new THREE.Vector3(),world=new THREE.Vector3(),delta=new THREE.Vector3();
 let cursor=0,distanceRemainder=0,driveRemainder=0,initialized=false,random=73519;
 const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
 const trailAlpha=modules['Boost_PS.ParticleModuleColorScaleOverLife_10'].AlphaScaleOverLife,trailSize=modules['Boost_PS.ParticleModuleSizeMultiplyLife_5'].LifeMultiplier;
 const driveAlpha=modules['Drive_PS.ParticleModuleColorScaleOverLife'].AlphaScaleOverLife,driveColor=modules['Drive_PS.ParticleModuleColorScaleOverLife'].ColorScaleOverLife,driveSize=modules['Drive_PS.ParticleModuleSizeMultiplyLife'].LifeMultiplier;
 function emit(local,t,nozzle){const p=pool[cursor];cursor=(cursor+1)%max;p.age=0;p.local=local;p.nozzle=nozzle;p.seed=rand();p.size=local?THREE.MathUtils.lerp(6.5,12.5,rand()):THREE.MathUtils.lerp(overrides.ParticleSize.Vector_Low[0],overrides.ParticleSize.Vector[0],rand());p.vy=THREE.MathUtils.lerp(15,30,rand());p.vx=THREE.MathUtils.lerp(-50,-100,rand());offset.copy(sockets[nozzle]).applyMatrix4(object.matrixWorld);if(!local)offset.addScaledVector(delta,t-1);p.p.copy(offset);}
 object.visible=false;
 return {object,update(dt,active,throttling=false){
  dt=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.1);time.value+=dt;strength.value=THREE.MathUtils.damp(strength.value,active?1:0,active?40:20,dt);
  object.updateWorldMatrix(true,false);center.setFromMatrixPosition(object.matrixWorld);delta.copy(center).sub(previous);const distance=delta.length();
  if(!initialized||distance>8){delta.set(0,0,0);distanceRemainder=0;for(const p of pool)p.age=2;initialized=true;}
  for(const p of pool)p.age+=dt;
  if(active){
   const tier=qualityControl?.value,spacing=tier==='low'?.64:tier==='balanced'?.48:.32;const traveled=delta.length();distanceRemainder+=traveled;const spawn=Math.min(24,Math.floor(distanceRemainder/spacing));distanceRemainder-=spawn*spacing;
   for(let i=0;i<spawn;i++)for(let n=0;n<sockets.length;n++){const rate=THREE.MathUtils.lerp(overrides.SpawnRate.Scalar_Low,overrides.SpawnRate.Scalar,rand()),births=Math.floor(rate)+(rand()<rate%1?1:0);for(let b=0;b<births;b++)emit(false,(i+(b+1)/Math.max(births,1))/Math.max(spawn,1),n);}
  }else distanceRemainder=0;
  // DrivingParticle -> FXTrait_BoostParticle_TA -> body BoostEmitterSockets.
  // The parent RocketBoost pivot is not an exhaust outlet; duplicate both modes.
  if(throttling&&!active){driveRemainder+=dt*10;while(driveRemainder>=1){driveRemainder--;for(let n=0;n<sockets.length;n++)emit(true,1,n);}}else driveRemainder=0;
  previous.copy(center);let count=0;
  for(const p of pool){const duration=p.local?.5:1;if(p.age>=duration)continue;const age=p.age/duration;
   if(p.local){world.copy(sockets[p.nozzle]);world.x+=p.vx*p.age;world.applyMatrix4(object.matrixWorld);}else{p.p.y+=p.vy*.01*p.age*dt;world.copy(p.p);}
   const o=count*4;positions[o]=world.x;positions[o+1]=world.y;positions[o+2]=world.z;positions[o+3]=p.size*.01*sample(p.local?driveSize:trailSize,age,0,3);
   life[o]=age;life[o+1]=sample(p.local?driveAlpha:trailAlpha,age);life[o+2]=p.seed;life[o+3]=p.local?1:0;
   const c=count*3;tints[c]=2.5*(p.local?sample(driveColor,age,0,3):1);tints[c+1]=p.local?sample(driveColor,age,1,3):1;tints[c+2]=.125*(p.local?sample(driveColor,age,2,3):1);count++;
  }
  geometry.instanceCount=count;geometry.attributes.particle.needsUpdate=true;geometry.attributes.life.needsUpdate=true;geometry.attributes.tint.needsUpdate=true;
  cone.visible=strength.value>.005;flare.visible=cone.visible;object.visible=count>0||cone.visible;object.userData.particleCount=count;object.userData.nozzleSockets=attachments.sockets;
 },reset(){for(const p of pool)p.age=2;initialized=false;distanceRemainder=0;driveRemainder=0;strength.value=0;geometry.instanceCount=0;object.visible=false;},dispose(){flareMaterial.dispose();geometry.dispose();quad.dispose();coneGeometry.dispose();material.dispose();coneMaterial.dispose();for(const m of maps)m.dispose();}};
}
