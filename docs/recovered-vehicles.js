import {TierTextureLoader} from './texture-tiers.js';
import * as THREE from 'three';
import {bodyShader,chassisShader,ballShader} from './recovered-vehicle-shaders.js';
import {detailReflection,detailTime,createRecoveredDetail} from './recovered-details.js';
import {parkFogGLSL,parkFogUniforms} from './park-height-fog.js';

let sourcePromise;
const texturePromises=new Map();
function sources(){return sourcePromise??=Promise.all(['vehicle-source','vehicle-bindings','team-detail-colors'].map(n=>fetch('./assets/original/'+n+'.json').then(r=>{if(!r.ok)throw Error(n+': '+r.status);return r.json();})));}
function texture(info){
 if(!texturePromises.has(info.url))texturePromises.set(info.url,new TierTextureLoader().loadAsync(info.url).then(t=>{
  const p=info.properties;t.flipY=false;t.colorSpace=p.SRGB===false||p.SRGB==='False'?THREE.NoColorSpace:THREE.SRGBColorSpace;
  t.wrapS=p.AddressX==='TA_Clamp'?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=p.AddressY==='TA_Clamp'?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
  t.anisotropy=4;if(p.MipGenSettings==='TMGS_NoMipmaps'){t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;}return t;
 }));return texturePromises.get(info.url);
}
function scalar(e,over){
 const kind=e.type.replace('FMaterialUniformExpression',''),f=Math.fround;
 if(kind==='ScalarParameter')return f(over[e.parameter]??e.default);
 if(kind==='Constant')return f(e.value[0]);
 if(kind==='Time'||kind==='RealTime')return f(detailTime.value);
 if(kind==='FoldedMath'){const a=scalar(e.a,over),b=scalar(e.b,over);return f(e.operation===0?a+b:e.operation===1?a-b:e.operation===2?a*b:a/b);}
 if(kind==='Fmod')return f(scalar(e.a,over)%scalar(e.b,over));
 if(kind==='Clamp')return f(Math.max(scalar(e.minimum,over),Math.min(scalar(e.maximum,over),scalar(e.input,over))));
 throw Error('Unsupported native vehicle uniform '+kind);
}
export function prepareVehicleGeometry(g){
 if(!g.attributes.tangent)g.computeTangents();
 const tangent=g.attributes.tangent.clone();
 // UModel changes XYZ handedness but retains the native tangent sign.
 for(let i=0;i<tangent.count;i++)tangent.setW(i,-tangent.getW(i));
 g.setAttribute('sourceVehicleTangent',tangent);return g;
}
export async function createOriginalLenses(){
 const [source,[,,teams]]=await Promise.all([fetch('./assets/original/detail-source.json').then(r=>r.json()),sources()]);
 const normal=await texture(source.textures[source.materials.Lens.textures[0]]);
 return createRecoveredDetail('Lens',{scalar:{}},[normal,null],teams,null);
}
export async function createRecoveredVehicle(kind){
 const [source,bindings,teams]=await sources(),m=bindings[kind],refs=source.materials[kind].textureArray;
 const cb=Array.from({length:128},()=>new THREE.Vector4()),view=Array.from({length:5},()=>new THREE.Vector4()),material=Array.from({length:5},()=>new THREE.Vector4());material[3].w=1;
 for(const [slot,value]of Object.entries(teams.registers))cb[Number(slot)].fromArray(value);
 const vectors={...m.overrides.Vector},scalars={...m.overrides.Scalar};
 // Preserve the viewer's selected blue paint as a runtime customization.
 if(kind==='Body')vectors.TeamColor=[...new THREE.Color(0x1358bd).toArray(),1];
 for(const b of m.bindings.vectors){const e=m.uniforms.vectors[b.expressionIndex];cb[b.baseIndex/16].fromArray(vectors[e.parameter]??e.default);}
 const uniforms={...parkFogUniforms,surfaceCB:{value:cb},surfaceViewCB:{value:view},surfaceMaterialCB:{value:material}};
 await Promise.all(m.bindings.textures2D.map(async b=>{const e=m.uniforms.textures2D[b.expressionIndex],path=m.overrides.Texture[e.parameter]??refs[e.textureIndex];uniforms['surface_t'+b.baseIndex]={value:await texture(source.textures[path])};}));
 const cubeSlot=Object.entries(m.source.textures).find(([,dimension])=>dimension==='cube')[0];uniforms['surface_'+cubeSlot]=detailReflection;
 const code={Body:bodyShader,Chassis:chassisShader,Ball:ballShader}[kind].replace(new RegExp('textureCube\\(surface_'+cubeSlot+',([^;]+?)\\.xyz\\)','g'),'textureCube(surface_'+cubeSlot+',$1.xzy)');
 const varying='varying vec4 vehicleRowX,vehicleRowZ,vehiclePosition;varying vec3 vehicleViewTS;varying vec2 vehicleUV;';
 const args=Object.keys(m.source.inputs).map(v=>({v0:'vehicleRowX',v1:'vehicleRowZ',v3:'vec4(vehicleUV,0.,0.)',v4:'vec4(vehicleViewTS,1.)',v6:'vehiclePosition'}[v]??(()=>{throw Error('Unbound vehicle input '+v);})())).join(',');
 const result=new THREE.MeshPhongMaterial({shininess:kind==='Body'?70:40,specular:kind==='Body'?0x536a83:0x56616a});
 result.name='Recovered '+kind+' source surfaces';
 result.onBeforeCompile=s=>{
  Object.assign(s.uniforms,uniforms);
  s.vertexShader='attribute vec4 sourceVehicleTangent;'+varying+'\n'+parkFogGLSL+'\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec3 vehicleWorld=(modelMatrix*vec4(transformed,1.)).xyz;parkWorldPosition=vehicleWorld;
   vec3 vn=normalize(mat3(modelMatrix)*objectNormal),vt=normalize(mat3(modelMatrix)*sourceVehicleTangent.xyz),vb=cross(vn,vt)*sourceVehicleTangent.w;
   vehicleRowX=vec4(vt.x,vb.x,vn.x,0.);vehicleRowZ=vec4(vt.y,vb.y,vn.y,-sourceVehicleTangent.w);
   vec3 eye=cameraPosition-vehicleWorld;vehicleViewTS=vec3(dot(vt,eye),dot(vb,eye),dot(vn,eye));
   vehicleUV=uv;vehiclePosition=${kind==='Body'?'vec4(0.,0.,0.,-mvPosition.z*100.)':'vec4((vehicleWorld-cameraPosition).xzy*100.,1.)'};`);
  s.fragmentShader=varying+'\n'+parkFogGLSL+'\n'+code+'\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec3 nativeEmission=recovered${kind}(${args}).rgb;diffuseColor.rgb=sourceDiffuse;`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*sourceWorldNormal.xzy);');
  s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','totalEmissiveRadiance+=nativeEmission;');
  s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=applyParkHeightFog(outgoingLight);\n#include <opaque_fragment>');
 };
 result.customProgramCacheKey=()=> 'native-vehicle-surface-'+kind+'-v1';
 const point=new THREE.Vector3(),direction=new THREE.Vector3();
 result.onBeforeRender=(renderer,scene,camera)=>{
  point.setFromMatrixPosition(camera.matrixWorld);cb[26].set(point.x*100,point.z*100,point.y*100,0);cb[27].copy(cb[26]);
  direction.setFromMatrixColumn(camera.matrixWorld,2).normalize().negate();view[0].w=direction.x;view[1].w=direction.z;view[2].w=direction.y;view[3].w=0;
  for(const b of m.bindings.scalars){const start=b.expressionIndex*4;for(let i=0;i<4;i++)cb[b.baseIndex/16].setComponent(i,m.uniforms.scalars[start+i]?scalar(m.uniforms.scalars[start+i],scalars):0);}
 };
 result.userData.recoveredSurface=kind.toLowerCase();result.userData.parkHeightFog=true;
 result.userData.shaderParity='Native diffuse, normal and emissive material programs with source MIC texture overrides. Dynamic lighting and specular highlights use the existing viewer lighting.';
 result.userData.nativeScalars=scalars;
 if(kind==='Body')result.userData.setPaint=({primary,accent,finish})=>{
  vectors.TeamColor=[...new THREE.Color(primary).toArray(),1];
  vectors.CustomColor=[...new THREE.Color(accent).toArray(),1];
  vectors.TrimColor=[...new THREE.Color(accent).toArray(),1];
  for(const b of m.bindings.vectors){const e=m.uniforms.vectors[b.expressionIndex];if(vectors[e.parameter])cb[b.baseIndex/16].fromArray(vectors[e.parameter]);}
  result.shininess=finish==='matte'?5:70;result.specular.set(finish==='matte'?0x111111:0x536a83);
 };
 return result;
}
