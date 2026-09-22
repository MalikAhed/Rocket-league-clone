import * as THREE from 'three';
import {TierTextureLoader} from './texture-tiers.js';

// Original Startup and ss_default_SF Cascade assets, adapted to a bounded browser particle pool.
// Lifetimes/widths below come from the cooked distributions; this is not UE3.
export async function createVehicleEffects(scene,car,camera,config){
 const loader=new TierTextureLoader(),base='./assets/original/vehicle-effects/';
 const [fire,smoke]=await Promise.all([loader.loadAsync(base+'Noise_Fire_02_Pack.png'),loader.loadAsync(base+'Noise_Smoke_02_Pack.png')]);
 for(const texture of [fire,smoke]){texture.colorSpace=THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=1;}
 const dodgeAlpha=new Float32Array([0.0, 0.41845738887786865, 0.4127579927444458, 0.4006199240684509, 0.3828633427619934, 0.36030837893486023, 0.33377522230148315, 0.30408400297164917, 0.27205491065979004, 0.23850810527801514, 0.20426373183727264, 0.17014195024967194, 0.13696295022964478, 0.1055467501282692, 0.0767136812210083, 0.05128392577171326, 0.030077479779720306, 0.013914533890783787, 0.0036154077388346195, 4.470348358154297e-08]);
 const dodgeOffsets=[[64.0, 32.0, 0.0], [64.0, -32.0, 0.0], [-64.0, 32.0, 32.0], [-64.0, -32.0, 32.0]];
 // Classic product 1948: native ColorScaleOverLife/AlphaScaleOverLife samples.
 const classicRGB=new Float32Array([2.504570722579956, 2.0233678817749023, 2.636831045150757, 2.274930715560913, 1.756170630455017, 2.6512975692749023, 2.04529070854187, 1.4889733791351318, 2.6657638549804688, 1.8156507015228271, 1.2217761278152466, 2.6802303791046143, 1.5860106945037842, 0.9545789957046509, 2.6946966648101807, 1.3563706874847412, 0.6873817443847656, 2.709163188934326, 1.1267306804656982, 0.42018449306488037, 2.7236297130584717, 0.8970907926559448, 0.15298736095428467, 2.738095998764038, 0.7051226496696472, -0.06932192295789719, 2.7511167526245117, 0.6867299675941467, -0.042773663997650146, 2.794429302215576, 0.6448148488998413, 0.017727099359035492, 2.8931338787078857, 0.584702730178833, 0.10449360311031342, 3.0346899032592773, 0.5117188096046448, 0.20983949303627014, 3.2065577507019043, 0.43118852376937866, 0.32607781887054443, 3.3961963653564453, 0.3484369218349457, 0.4455224871635437, 3.5910654067993164, 0.26878952980041504, 0.5604864954948425, 3.7786247730255127, 0.19757166504859924, 0.6632831692695618, 3.946333885192871, 0.14010843634605408, 0.7462262511253357, 4.0816521644592285, 0.10172528028488159, 0.8016290068626404, 4.172039985656738, 0.08774751424789429, 0.8218046426773071, 4.204955577850342]);
 const classicAlpha=new Float32Array([0.0, 0.5, 1.0, 0.9975944757461548, 0.9902176260948181, 0.9776292443275452, 0.959588885307312, 0.9358564019203186, 0.9061912894248962, 0.8703534007072449, 0.8281023502349854, 0.7791978120803833, 0.7233995795249939, 0.6604670882225037, 0.5901605486869812, 0.5122389793395996, 0.42646244168281555, 0.33259063959121704, 0.23038288950920105, 0.1195998564362526, 0.0]);
 const root=new THREE.Group();root.name='Recovered vehicle movement effects';scene.add(root);
 // 0.1 seconds at native 120/s needs twelve segments/wheel. Extra slots cover
 // short frame stalls without allocating or growing the pool.
 const capacity=1024,positions=new Float32Array(capacity*18),uvs=new Float32Array(capacity*12),birth=new Float32Array(capacity*6),lifetimes=new Float32Array(capacity*6),kinds=new Float32Array(capacity*6);
 birth.fill(-10);
 for(let i=0;i<capacity;i++)uvs.set([0,0,1,0,0,1,0,1,1,0,1,1],i*12);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setAttribute('born',new THREE.BufferAttribute(birth,1).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('life',new THREE.BufferAttribute(lifetimes,1).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('effectKind',new THREE.BufferAttribute(kinds,1).setUsage(THREE.DynamicDrawUsage));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{map:{value:fire},time:{value:0},classicRGB:{value:classicRGB},classicAlpha:{value:classicAlpha},dodgeAlpha:{value:dodgeAlpha}},
  vertexShader:`attribute float born;attribute float life;attribute float effectKind;varying float vKind;varying vec2 vUv;varying float vBorn;varying float vLife;void main(){vKind=effectKind;vUv=uv;vBorn=born;vLife=life;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D map;uniform float time;uniform vec3 classicRGB[20];uniform float classicAlpha[21];uniform float dodgeAlpha[20];varying float vKind;varying vec2 vUv;varying float vBorn;varying float vLife;void main(){float age=(time-vBorn)/max(.001,vLife);if(age<0.||age>=1.)discard;float edge=pow(max(0.,1.-abs(vUv.x*2.-1.)),1.5);float noise=texture2D(map,vec2(vUv.x,vUv.y*.2+vBorn*4.)).g;float alpha=edge*(1.-age)*(.65+.35*noise)*.66;vec3 tint=vec3(2.2);if(vKind<.5){float a=clamp((age+.000951084774)*19.58989334,0.,19.);int i=int(floor(a));alpha=edge*.25*mix(dodgeAlpha[i],dodgeAlpha[min(i+1,19)],fract(a));}if(vKind>.5){float c=clamp((age+.0030378522)*19.51888466,0.,19.);int i=int(floor(c));int j=min(i+1,19);tint=max(vec3(0.),mix(classicRGB[i],classicRGB[j],fract(c))*2.);float a=age*20.;int ai=int(floor(a));alpha=edge*(.65+.35*noise)*mix(classicAlpha[ai],classicAlpha[min(ai+1,20)],fract(a));}gl_FragColor=vec4(tint,alpha);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 root.userData.trailProduct={id:1948,name:"Classic",asset:"ss_default.ss_default",particle:"ss_default.FX.SS_Default_PS",sourceColorCurve:true};
 const trails=new THREE.Mesh(geometry,material);trails.frustumCulled=false;trails.visible=false;root.add(trails);
 const puffGeometry=new THREE.PlaneGeometry(1,1),puffMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:smoke},age:{value:1},tile:{value:new THREE.Vector2()}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D map;uniform float age;uniform vec2 tile;varying vec2 vUv;void main(){vec4 n=texture2D(map,(vUv+tile)*.5);float edge=1.-smoothstep(.25,.5,length(vUv-.5));float opacity=n.b*edge*(1.-age)*.15;gl_FragColor=vec4(vec3(.72),opacity);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 const puffs=Array.from({length:8},(_,i)=>{const m=puffMaterial.clone();m.uniforms.tile.value.set(i%2,(i>>1)%2);const mesh=new THREE.Mesh(puffGeometry,m);mesh.visible=false;root.add(mesh);return {mesh,age:1,life:.5,size:.5,velocity:new THREE.Vector3()};});puffMaterial.dispose();
 const previous=Array.from({length:4},()=>new THREE.Vector3()),current=Array.from({length:4},()=>new THREE.Vector3()),valid=new Uint8Array(4);
 const dodgePrevious=Array.from({length:4},()=>new THREE.Vector3()),dodgeCurrent=new THREE.Vector3(),dodgeHead=new THREE.Vector3(),ribbonAxis=new THREE.Vector3(),tangent=new THREE.Vector3(),eye=new THREE.Vector3();
 const worldUp=new THREE.Vector3(0,1,0),side=new THREE.Vector3(),up=new THREE.Vector3(),center=new THREE.Vector3(),offset=new THREE.Vector3(),lastCar=new THREE.Vector3();
 const distortion={position:new THREE.Vector3(),normal:new THREE.Vector3(0,1,0),radius:0,strength:0,age:1,active:false};
 let time=0,cursor=0,puffCursor=0,ready=false,jumpSerial=0,dodgeSerial=0,doubleSerial=0,lastTick=-1,sonic=0,tailUntil=0,dodgeUntil=0,dodgeValid=false;
 function reset(){ready=false;valid.fill(0);birth.fill(-10);geometry.attributes.born.needsUpdate=true;trails.visible=false;tailUntil=0;dodgeUntil=0;dodgeValid=false;sonic=0;distortion.active=false;distortion.strength=0;for(const p of puffs){p.age=1;p.mesh.visible=false;}}
 function burst(state,air){
  if(!air){distortion.position.copy(center).addScaledVector(up,-.24);distortion.normal.copy(up);distortion.age=0;distortion.radius=.16;distortion.strength=1;distortion.active=true;}
  const p=puffs[puffCursor++%puffs.length];p.age=0;p.life=air?.33333:.5;p.size=air?.32:.64;p.mesh.position.copy(center).addScaledVector(up,-.12);p.velocity.set(state[34],state[36],state[35]).multiplyScalar(.001);p.mesh.visible=true;
 }
 function facingAxis(a,b){tangent.subVectors(b,a).normalize();eye.subVectors(camera.position,b).normalize();ribbonAxis.crossVectors(tangent,eye);if(ribbonAxis.lengthSq()<1e-8)ribbonAxis.copy(side);return ribbonAxis.normalize();}
 function segment(a,b,width,life=.1,kind=0,axis=side){
  const o=cursor*18,k=cursor*6;offset.copy(axis).multiplyScalar(width);
  positions[o]=a.x-offset.x;positions[o+1]=a.y-offset.y;positions[o+2]=a.z-offset.z;
  positions[o+3]=a.x+offset.x;positions[o+4]=a.y+offset.y;positions[o+5]=a.z+offset.z;
  positions[o+6]=b.x-offset.x;positions[o+7]=b.y-offset.y;positions[o+8]=b.z-offset.z;
  positions.copyWithin(o+9,o+6,o+9);positions.copyWithin(o+12,o+3,o+6);
  positions[o+15]=b.x+offset.x;positions[o+16]=b.y+offset.y;positions[o+17]=b.z+offset.z;
  birth.fill(time,k,k+6);lifetimes.fill(life,k,k+6);kinds.fill(kind,k,k+6);cursor=(cursor+1)%capacity;
 }
 return {object:root,distortion,get supersonic(){return sonic;},reset,update(dt,state){
  dt=Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0));time+=dt;material.uniforms.time.value=time;
  center.set(state[22]*.01,state[24]*.01,state[23]*.01);up.set(0,1,0).applyQuaternion(car.quaternion);side.set(0,0,1).applyQuaternion(car.quaternion);
  // Event serials, not held buttons: one burst per actual physics event.
  if(!ready||state[0]<lastTick||center.distanceToSquared(lastCar)>100){reset();ready=true;jumpSerial=state[63];dodgeSerial=state[64];doubleSerial=state[65];}
  else if(state[63]!==jumpSerial||state[64]!==dodgeSerial||state[65]!==doubleSerial){
   if(state[63]!==jumpSerial)burst(state,false);else if(state[64]!==dodgeSerial||state[65]!==doubleSerial)burst(state,true);
   if(state[64]!==dodgeSerial||state[65]!==doubleSerial){dodgeUntil=time+.5;dodgeValid=false;}
   jumpSerial=state[63];dodgeSerial=state[64];doubleSerial=state[65];}
  const newTick=state[0]!==lastTick;lastTick=state[0];lastCar.copy(center);
  sonic=THREE.MathUtils.damp(sonic,state[42]===1?1:0,8,dt);
  if(newTick){
   let wrote=false;
   for(let w=0;w<4;w++){
    const wheel=config.wheels[w],p=wheel.connectionXYZ;
    current[w].set(p[0],p[2]-wheel.suspensionRestLength-wheel.radius+8,p[1]).applyQuaternion(car.quaternion).multiplyScalar(.01).add(center);
    // Anchor to the actual rendered wheel joint when the body supplies one.
    const visual=car.userData.wheels?.find(v=>Math.sign(v.position.x)===Math.sign(p[0])&&Math.sign(v.position.z)===Math.sign(p[1]));
    if(visual){current[w].copy(visual.position);current[w].y-=p[0]>0?12.75:13.75;current[w].y+=8;current[w].applyQuaternion(car.quaternion).multiplyScalar(.01).add(center);}
    if(up.y>.95)current[w].y=Math.max(.08,current[w].y);
    const active=p[0]<0&&state[42]===1&&state[50+w*3]===1&&state[43]!==1;
    if(active&&valid[w]&&current[w].distanceToSquared(previous[w])<4){segment(previous[w],current[w],.06,.1,1,facingAxis(previous[w],current[w]));segment(previous[w],current[w],.04,.1,1,worldUp);wrote=true;tailUntil=Math.max(tailUntil,time+.1);}
    previous[w].copy(current[w]);valid[w]=active?1:0;
   }
   if(time<dodgeUntil){
    // Four active trails from the six authored offsets, including rear Z=32.
    // SpawnPerUnit is one point per 32 UU; retain its real 1-second lifetime.
    for(let w=0;w<4;w++){
     const p=dodgeOffsets[w];dodgeCurrent.set(p[0]*.01,p[2]*.01,p[1]*.01).applyQuaternion(car.quaternion).add(center);
     if(!dodgeValid){dodgePrevious[w].copy(dodgeCurrent);continue;}
     let distance=dodgePrevious[w].distanceTo(dodgeCurrent),steps=0;
     while(distance>=.32&&steps++<16){dodgeHead.copy(dodgePrevious[w]).lerp(dodgeCurrent,.32/distance);segment(dodgePrevious[w],dodgeHead,.005,1,0,facingAxis(dodgePrevious[w],dodgeHead));dodgePrevious[w].copy(dodgeHead);distance=dodgePrevious[w].distanceTo(dodgeCurrent);wrote=true;tailUntil=Math.max(tailUntil,time+1);}
    }dodgeValid=true;
   }else dodgeValid=false;
   if(wrote){geometry.attributes.position.needsUpdate=true;geometry.attributes.born.needsUpdate=true;geometry.attributes.life.needsUpdate=true;geometry.attributes.effectKind.needsUpdate=true;}
  }
  trails.visible=time<tailUntil;
  for(const p of puffs){if(p.age>=1)continue;p.age=Math.min(1,p.age+dt/p.life);p.mesh.visible=p.age<1;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.quaternion.copy(camera.quaternion);p.mesh.scale.setScalar(p.size*(1+p.age*3));p.mesh.material.uniforms.age.value=p.age;}
  if(distortion.active){distortion.age+=dt/.33333;distortion.active=distortion.age<1;distortion.radius=.16*(1+Math.min(1,distortion.age)*7.57);distortion.strength=Math.max(0,1-distortion.age);}
 },dispose(){root.removeFromParent();geometry.dispose();material.dispose();puffGeometry.dispose();for(const p of puffs)p.mesh.material.dispose();fire.dispose();smoke.dispose();}};
}


