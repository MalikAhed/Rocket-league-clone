import {TierTextureLoader} from './texture-tiers.js';
import * as THREE from 'three';
import {withParkFog} from './park-height-fog.js';
import {createRecoveredSurface} from './recovered-surfaces.js';
import {createRecoveredNet} from './recovered-net.js';
import {createRecoveredAtmosphere} from './recovered-atmosphere.js';
import {createRecoveredGlass} from './recovered-glass.js';
import {createRecoveredDetail} from './recovered-details.js';
let ready;
export function sourceAssets(){return ready??=(async()=>{
 const [c,g,b]=await Promise.all([fetch('./assets/original/catalog.json').then(r=>r.json()),fetch('./assets/original/geometry.json').then(r=>r.json()),fetch('./assets/original/geometry.bin').then(r=>r.arrayBuffer())]);
 const textures=new Map(),materials=new Map(),cubes=new Map(),pendingTextures=[],loader=new TierTextureLoader();
 const [nativeNet,atmosphereGeometry,atmosphereData,nativeGlass,glassSource]=await Promise.all(['native-net-attributes.json','native-atmosphere-geometry.json','atmosphere.json','native-glass-attributes.json','hexglass-source.json'].map(name=>fetch('./assets/original/'+name).then(r=>r.json())));
 const [detailSource,detailTeams,detailLighting]=await Promise.all(['detail-source.json','team-detail-colors.json','component-lighting.json'].map(name=>fetch('./assets/original/'+name).then(r=>r.json())));
 function cube(path){
  if(cubes.has(path))return cubes.get(path);
  // Unreal Z-up cube faces mapped into this port's Y-up basis.
  const urls=[0,1,4,5,2,3].map(i=>c.textures[`${path}.CubemapFace${i}`]?.url);
  if(urls.some(x=>!x))return null;
  let done,failed;pendingTextures.push(new Promise((resolve,reject)=>{done=resolve;failed=reject;}));
  const t=new THREE.CubeTextureLoader().load(urls,done,undefined,failed);t.colorSpace=THREE.SRGBColorSpace;cubes.set(path,t);return t;
 }
 function textureURL(url,linear=false,variant=''){
  const key=url+'|'+linear+'|'+variant;
  if(textures.has(key))return textures.get(key);
  let done,failed;pendingTextures.push(new Promise((resolve,reject)=>{done=resolve;failed=reject;}));
  const t=loader.load(url,done,undefined,failed);t.userData.sourceURL=url;t.flipY=false;t.colorSpace=linear?THREE.NoColorSpace:THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=2;textures.set(key,t);return t;
 }
 function nativeCube(path){
  const key='native:'+path;if(cubes.has(key))return cubes.get(key);
  const urls=[0,1,2,3,4,5].map(i=>c.textures[`${path}.CubemapFace${i}`]?.url);
  if(urls.some(x=>!x))throw new Error(`Missing original cubemap face: ${path}`);
  let done,failed;pendingTextures.push(new Promise((resolve,reject)=>{done=resolve;failed=reject;}));
  // Shader directions stay in the native coordinate system. Preserve FacePosX,
  // FaceNegX, FacePosY, FaceNegY, FacePosZ, FaceNegZ and source image UVs.
  const t=new THREE.CubeTextureLoader().load(urls,done,undefined,failed);
  t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;cubes.set(key,t);return t;
 }
 function tex(path,linear=false,variant=''){
  if(!path||path==='None')return null;
  const url=c.textures[path]?.url;return url?textureURL(url,linear,variant):null;
 }
 function resolve(name,seen=new Set()){
  if(seen.has(name))return {parameters:{},textures:[],properties:{}};seen.add(name);
  const m=c.materials[name];if(!m)return {parameters:{},textures:[],properties:{}};
  const p=resolve(m.properties.Parent,seen),typed={};
  for(const kind of ['scalar','vector','texture','switch'])typed[kind]={...p.typed?.[kind],...m.typedParameters?.[kind]};
  return {parameters:{...p.parameters,...m.parameters},typed,textures:[...new Set([...m.textures,...p.textures])],properties:{...p.properties,...m.properties}};
 }
 const color=(v,fallback)=>Array.isArray(v)?new THREE.Color().setRGB(...v.slice(0,3)):new THREE.Color(fallback);
 function mat(name,mesh,instance){
  const kind=name==='Park_Assets.Materials.Frame_V2_MIC'||name==='FutureTech.Materials.Frame_01_V2_Mat'?'Frame':name==='Park_Assets.Mat.MIC_Park_BannerFlag00_Psy00'?'Flag':name==='FutureTech.Materials.Frame_01_CamFade_Mat'?'FrameFade':name==='FutureTech.Materials.Frame_01_WSR_Team1_MIC'?'FrameWSR':null;
  const cacheKey=(kind==='Frame'||kind==='FrameWSR')?name+'|'+instance?.name:name;
  if(materials.has(cacheKey))return materials.get(cacheKey);
  const d=resolve(name),p={...d.parameters,...d.typed?.vector,...d.typed?.scalar},refs=d.textures;
  const textureParameters=d.typed?.texture??{};
  const find=rx=>refs.find(n=>rx.test(n));
  let map=tex(textureParameters.Diffuse||p.Diffuse||find(/(_D|_Color|_RGB|Net_D)$/)),normal=tex(textureParameters.Normal||p.Normal||find(/(_N|_Nornal)$/),true);
  let m=new THREE.MeshPhongMaterial({map,normalMap:normal,normalScale:new THREE.Vector2(1,-1),color:color(p.Color||p.DiffuseColor,0xffffff),shininess:20,specular:0x303a3e,side:THREE.DoubleSide});
  const modify=(id,body,uniforms={})=>{m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);s.fragmentShader=s.fragmentShader.replace('void main() {',Object.keys(uniforms).map(n=>`uniform sampler2D ${n};`).join('\n')+'\nvoid main() {').replace('#include <map_fragment>','#include <map_fragment>\n'+body);};m.customProgramCacheKey=()=>id+'|'+body;};
  if(/LightCone|GoalGenerator/.test(name)){m.visible=false;}
  else if(/Lombardy/.test(name)){
   m.map=tex('Trees_Textures.LombardyPoplar_Branch_Low');m.normalMap=null;m.alphaTest=.33329999446868896;m.shininess=0;m.specular.setHex(0x000000);
   // Inherits Engine Default__Texture.SRGB=true; Texture2D does not override it.
   // Exact albedo from RefShaderCache material GUID 2e4eb4040ce9b846bc7d420aac97d32d.
   // The cooked expression graph is stripped, but its compiled DXBC survives.
   // Source vertex B selects hue; source vertex R controls brightness.
   const brightness=Number(d.typed?.scalar?.Brightness??1);
   modify('original-poplar-dxbc',`vec4 leaf=texture2D(map,vMapUv);diffuseColor.rgb=(parkFoliageColor.b*vec3(.23627105355262756,.044343724846839905,-.013269690796732903)+vec3(.08968380093574524,.12706714868545532,.029488790780305862))*${brightness.toFixed(9)}*(leaf.g+.5)*(parkFoliageColor.r*6.+2.);diffuseColor.a=leaf.a;`);
   const before=m.onBeforeCompile;
   m.defaultAttributeValues={sourceColor:[1,1,1,1]};
   m.onBeforeCompile=s=>{before(s);s.vertexShader='attribute vec4 sourceColor;\nvarying vec4 parkFoliageColor;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('void main() {','void main() {\nparkFoliageColor=sourceColor;');s.fragmentShader='varying vec4 parkFoliageColor;\n'+s.fragmentShader;};
  }else if(/SimpleTree/.test(name)){
   m.map=tex('Trees_Textures.OOB_PoplarTree_T');m.alphaTest=.333;m.shininess=1;
  }else if(/Mountain|Hills/.test(name)){
   m.map=tex(p.Diffuse||'Mountains_Textures.Mountain_B_Color');m.normalMap=tex(p.Normal||'Mountains_Textures.Mountain_B_Nornal',true);m.shininess=3;
   if(!/Hills/.test(name))modify('original-mountain-snow','vec4 mask=texture2D(snowMask,vMapUv);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.25),mask.b);',{snowMask:{value:tex('Mountains_Textures.Mountain_B_Mask_Pack',true)}});
  }else if(/GrassAndBush/.test(name)){m.map=tex('Terrain_Textures.GrassAndBush_D');m.normalMap=tex('Terrain_Textures.GrassAndBush_N',true);m.shininess=4;}
  else if(/RiverStrip/.test(name)){
   m.map=tex('Terrain_Textures.RiverStrip_D');m.normalMap=tex('Terrain_Textures.RiverStrip_N',true);m.shininess=95;m.specular.setHex(0xa4c4cc);
  }else if(/Concrete_Hexagons/.test(name)){
   m.map=textureURL('./assets/original/Hexagons_Pack.png',true);
   m.normalMap=textureURL('./assets/original/Hexagons_N.png',true);m.shininess=4;
   modify('hex-pack','diffuseColor.rgb=vec3(.32,.34,.33)*(.45+diffuseColor.g*.55);');
  }else if(/ConcreteTrim/.test(name)){m.color.setHex(0x697774);m.shininess=4;}
  else if(/ConcreteWall/.test(name)){m.map=tex('Stadium_Textures.ConcreteWall_D');m.normalMap=tex('Stadium_Textures.ConcreteWall_N',true);m.shininess=4;}
  else if(/SideWalk/.test(name)){m.map=tex('City_Textures.SideWalk_Pack',true);m.normalMap=tex('City_Textures.SideWalk_N',true);m.shininess=4;modify('sidewalk','diffuseColor.rgb=vec3(.35,.38,.36)*(.6+diffuseColor.r*.4);');}
  else if(/Stairs|Bleachers/.test(name)){m.map=tex('Stadium_Textures.Stairs_Pack',true);m.normalMap=tex('Stadium_Textures.Stairs_N',true);modify('stairs','diffuseColor.rgb=vec3(.28,.32,.34)*(.35+diffuseColor.r*.65);');}
  else if(/BuildingGlass/.test(name)){
   // Diffuse and emissive reference the same cooked root. Use a single
   // prelit response and the actual instance cubemap/ENV scalar.
   // Legacy fallback for other building materials. Park's BuildingGlass_MIC
   // is replaced below with its recovered compiled shader and native bindings.
   m=new THREE.MeshBasicMaterial({map:tex(textureParameters.Masks||'City_Textures.Building_A_Pack',true),color:0xffffff,side:THREE.DoubleSide,
    envMap:cube(textureParameters.CubeMap),combine:THREE.AddOperation,reflectivity:Number(p.ENV??1)});
   const tint=Array.isArray(p.Color)?p.Color:[.15,.13,.09];
   modify('building-source-reflection',`vec3 pack=texture2D(map,vMapUv).rgb;vec3 glass=vec3(${tint.slice(0,3).join(',')})*(.3+pack.b*.7);float frame=clamp(pack.r*.45+pack.g*.55,0.,1.);diffuseColor.rgb=mix(glass,vec3(.68,.72,.71),frame);`);
  }else if(/Flag.*Psy/.test(name)){
   m.map=tex('Park_Assets.Textures.Park_BannerFlag00_RGB',true);m.normalMap=null;m.color.setHex(0xffffff);m.shininess=4;
   modify('park-flag','diffuseColor.rgb=mix(vec3(.008,.055,.15),vec3(.82,.86,.84),diffuseColor.r);');
  }else if(/MetalTexture/.test(name)){m.map=tex('OldCosmic_Assets.Z_Old.TEC_Trim_02_D');m.normalMap=tex('OldCosmic_Assets.Z_Old.TEC_Trim_02_N',true);m.shininess=60;}
  else if(/Frame_|Frame_V2|FlagPole/.test(name)){m.map=null;m.color.setHex(0x899ea4);m.normalMap=tex('Detail_BrushesMetal.BrushedMetal_N',true);m.shininess=85;m.specular.setHex(0x9dacb0);m.envMap=cube('Park_Assets.Textures.OOBCube');m.combine=THREE.MixOperation;m.reflectivity=.3;}
  else if(/Metal_Trim/.test(name)){m.map=tex('Farm_Textures.Textures.Farm_MetalBase_D');m.normalMap=tex('Farm_Textures.Textures.Farm_MetalBase_N',true);m.shininess=40;}
  else if(/DarkMetal/.test(name)){m.map=null;m.color.setHex(0x38464b);m.normalMap=tex('Detail_BrushesMetal.BrushedMetal_N',true);m.shininess=45;}
  else if(/Fence|NetLines/.test(name)||mesh==='Field_STD_Net'){
   m.map=tex('Goal_Textures.Net_D');m.normalMap=null;m.alphaTest=.4;m.color.setHex(0x62757b);m.shininess=25;
  }else if(/HexGlass|Glass/.test(name)){
   m.map=null;m.normalMap=null;m.color.setHex(0x9ac4d0);m.transparent=true;m.opacity=.035;m.depthWrite=false;m.shininess=90;
  }else if(/Glow/.test(name)){m=new THREE.MeshBasicMaterial({color:/Team2/.test(name)?0xe6892a:0x2372c5,side:THREE.DoubleSide,transparent:true,opacity:.3,depthWrite:false});}
  else if(/Boost/.test(name)){
   m.map=tex('Pickup_Boost_Textures.'+(/Large/.test(name+mesh)?'BoostPad_Large_D':'BoostPad_Small_D'),true);m.normalMap=null;m.shininess=60;
   modify('boost-mask','vec3 v=diffuseColor.rgb;diffuseColor.rgb=mix(vec3(.06,.075,.08),vec3(.35,.4,.42),v.g);totalEmissiveRadiance+=vec3(1.,.42,.025)*v.b*1.2;');
  }else if(/Adverts|Advert/.test(name)){
   // Use the referenced ad, including material-instance AdNumber overrides.
   let t=tex(p.AdTexture||'Adverts_Textures.RocketLeagueAd_Dark');
   if(p.AdNumber!==undefined){
    const n=Number(p.AdNumber);
    // A clone marks itself for upload even when its shared source image has
    // not loaded. Separate tracked textures keep UV transforms independent
    // and are marked for upload only by TextureLoader's completion callback.
    t=tex('Adverts_Textures.Advert_Strip',false,'advert-'+n);
    t.repeat.set(.25,.5);t.offset.set((n%4)*.25,Math.floor(n/4)*.5);
   }
   m=new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide});
  }else if(/MAT_Lights/.test(name)){m=new THREE.MeshBasicMaterial({color:0xe8e5c7,side:THREE.DoubleSide});}
  else if(/Basic_Orange/.test(name)){m.color.setHex(0xbd762d);}
  m.name=name;m.userData.sourceMaterial=name;
  if(kind){
   const source=detailSource.materials[kind],binding=detailLighting.components[instance?.name];
   const textures=source.textures.map(path=>{
    if(path==='Grass_Textures.GrassCube')return null;
    const data=detailSource.textures[path],p=data.properties,t=textureURL(data.url,p.SRGB==='False');
    if(p.MipGenSettings==='TMGS_NoMipmaps'){t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;}
    if(p.AddressX==='TA_Clamp')t.wrapS=THREE.ClampToEdgeWrapping;
    if(p.AddressY==='TA_Clamp')t.wrapT=THREE.ClampToEdgeWrapping;
    return t;
   });
   if(kind==='Frame'||kind==='FrameWSR')for(const slot of binding.slots.slice(0,2)){
    const t=textureURL(detailLighting.textures[slot.texture].url,true);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;textures.push(t);
   }
   m.dispose();m=createRecoveredDetail(kind,d.typed,textures,detailTeams,binding);
  }else if(/Lombardy/.test(name)){
   m.dispose();m=createRecoveredSurface('foliage',d.typed,{texture:tex('Trees_Textures.LombardyPoplar_Branch_Low')});
  }else if(name==='Park_Assets.Materials.BuildingGlass_MIC'){
   m.dispose();m=createRecoveredSurface('building',d.typed,{texture:tex(textureParameters.Masks||'City_Textures.Building_A_Pack'),cube:nativeCube(textureParameters.CubeMap)});
  }else if(name==='Park_Assets.Materials.Park_Fence_Dark_MIC'){
   m.dispose();m=createRecoveredNet(d.typed,tex('Goal_Textures.Net_D'),tex(textureParameters.BallTracker));
  }else if(name==='Mountains.Mountain_Mat'||name==='Mountains.Hills_A_MIC'){
   // These source textures inherit SRGB=true, including the texture named Normal.
   // Preserve the actual sample values expected by the cooked pixel program.
   m.dispose();m=createRecoveredSurface('mountain',d.typed,{texture:tex(textureParameters.Normal),diffuse:tex(textureParameters.Diffuse),mask:tex('Mountains_Textures.Mountain_B_Mask_Pack')});
  }else if(name.startsWith('FutureTech.Materials.HexGlass_')){
   const textures=glassSource.textureArray.map(path=>{
    const p=c.textures[path].properties,t=tex(path,p.SRGB==='False');
    if(p.MipGenSettings==='TMGS_NoMipmaps'){t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;}
    if(p.AddressX==='TA_Clamp')t.wrapS=THREE.ClampToEdgeWrapping;
    if(p.AddressY==='TA_Clamp')t.wrapT=THREE.ClampToEdgeWrapping;
    return t;
   });
   m.dispose();m=createRecoveredGlass(...textures,d.properties);
  }else if(atmosphereData.materialBindings[name]){
   const binding=atmosphereData.materialBindings[name],t=tex(binding.texture),tp=c.textures[binding.texture].properties;
   if(tp.AddressX==='TA_Clamp')t.wrapS=THREE.ClampToEdgeWrapping;
   if(tp.AddressY==='TA_Clamp')t.wrapT=THREE.ClampToEdgeWrapping;
   m.dispose();m=createRecoveredAtmosphere(binding,t,d.properties);
  }
  m.name=name;m.userData.sourceMaterial=name;
  m.userData.sourceLightingModel=d.properties.LightingModel??'default';
  if(!m.userData.recoveredSurface&&/SimpleTree|BuildingGlass/.test(name))m.userData.shaderParity='approximate: original shader integration pending';
  if(/Adverts|Advert/.test(name)&&m.isMeshBasicMaterial&&m.map?.userData.sourceURL){
   m.userData.adAtlasMap=textureURL(m.map.userData.sourceURL,false,'shared-ad-atlas');
  }
  withParkFog(m);materials.set(cacheKey,m);return m;
 }
 function geometry(name){
  if(atmosphereGeometry[name]){
   const geom=new THREE.BufferGeometry(),d=atmosphereGeometry[name];
   for(const [key,size]of Object.entries({position:3,uv:2,sourceColor:4}))geom.setAttribute(key,new THREE.Float32BufferAttribute(d[key],size));
   geom.setAttribute('uv1',geom.getAttribute('uv').clone());geom.setAttribute('uv2',geom.getAttribute('uv').clone());geom.addGroup(0,d.position.length/3,0);return geom;
  }
  const parts=g[name],geom=new THREE.BufferGeometry(),attrs={};let start=0;
  for(const p of parts){for(const [key,a] of Object.entries(p.attributes)){(attrs[key]??=[]).push(new Float32Array(b,a.offset,a.length));}geom.addGroup(start,p.count,p.materialIndex);start+=p.count;}
  for(const [key,parts] of Object.entries(attrs)){const size={POSITION:3,NORMAL:3,TANGENT:4,TEXCOORD_0:2,TEXCOORD_1:2,TEXCOORD_2:2}[key];const data=new Float32Array(start*size);let offset=0;for(const a of parts){data.set(a,offset);offset+=a.length;}geom.setAttribute({POSITION:'position',NORMAL:'normal',TANGENT:'tangent',TEXCOORD_0:'uv',TEXCOORD_1:'uv1',TEXCOORD_2:'uv2'}[key],new THREE.BufferAttribute(data,size));}
  if(!geom.hasAttribute('uv1'))geom.setAttribute('uv1',geom.getAttribute('uv').clone());
  if(nativeNet[name]||nativeGlass[name])for(const [key,size]of Object.entries({position:3,uv:2,sourceColor:4})){
   const values=(nativeNet[name]??nativeGlass[name])[key];if(values.length!==start*size)throw new Error('Native translucent mesh stream count mismatch');
   geom.setAttribute(key,new THREE.Float32BufferAttribute(values,size));
  }
  if(!geom.hasAttribute('uv2'))geom.setAttribute('uv2',geom.getAttribute('uv').clone());
  return geom;
 }
 return {mat,tex,geometry,catalog:c,whenTexturesReady:()=>Promise.all(pendingTextures)};
})();}
