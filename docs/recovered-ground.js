import {TierTextureLoader} from './texture-tiers.js';
import * as THREE from 'three';
import {geometryLoader} from './geometry-loader.js';
import {withParkFog} from './park-height-fog.js';
import {sourceMaterial} from './park-render-data.js';
import {fieldShader23,fieldShader31} from './recovered-field-shaders.js';

// Original material GUID + static permutation -> original DXBC -> GLSL.
// Exact native inputs accompany the shader; cube-edge processing remains tracked.
export async function originalGround({reflectionTexture=null}={}){
 const low=new URLSearchParams(location.search).get('fieldQuality')==='low';
 const [asset,catalog,teams,nativeTBN]=await Promise.all([
  geometryLoader().loadAsync('./assets/original/ground/Grass_Base.gltf'),
  fetch('./assets/original/catalog.json').then(r=>r.json()),
  fetch('./assets/original/team-global-colors.json').then(r=>r.json()),
  fetch('./assets/original/ground-native-tbn.json').then(r=>r.json()),
 ]);
 const loader=new TierTextureLoader();
 async function texture(name,{packed=false,url=null}={}){
  const entry=catalog.textures[name];if(!entry)throw new Error(`Missing source field texture: ${name}`);
  const t=await loader.loadAsync(url??(packed?entry.packedUrl:entry.url)??entry.url);
  t.flipY=false;
  // Engine Default__Texture.SRGB=true; source normal textures override it.
  t.colorSpace=entry.properties.SRGB==='False'?THREE.NoColorSpace:THREE.SRGBColorSpace;
  const address=v=>v==='TA_Mirror'?THREE.MirroredRepeatWrapping:v==='TA_Clamp'?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
  t.wrapS=address(entry.properties.AddressX);t.wrapT=address(entry.properties.AddressY);t.anisotropy=4;
  return t;
 }
 const textures=low?await Promise.all([
  texture('FX_Textures.Noise.Noise_Generic_02_Pack'),
  texture('FieldSkin_Park.FieldSkin_Park_1x1',{url:'./assets/field-skin.png'}),
 ]):await Promise.all([
  texture('Terrain_Textures.RockyDirt_N',{packed:true}),
  texture('FX_Textures.Noise.Noise_Generic_N'),
  texture('FieldSkin_Park.Park_GrassMask_Low_M'),
  texture('FX_Textures.Noise.Noise_Generic_02_Pack'),
  texture('Terrain_Textures.RockyDirt_D'),
  texture('FieldSkin_Park.FieldSkin_Park_1x1',{url:'./assets/field-skin.png'}),
  texture('Park_Assets.Textures.FloorLightMap'),
 ]);
 const source=sourceMaterial('Park_Assets.Materials.Grass_Base_Team1_MIC');
 const constants=Array.from({length:83},()=>new THREE.Vector4());
 // Absolute worldUE has already canceled native PreViewTranslation (CB26=0).
 // Native upload binding: Team0 primary -> CB36, Team1 primary -> CB38.
 // Includes original byte quantization and gamma2.2 FColor conversion.
 constants[36].fromArray(teams.find(t=>t.name==='CustomColors.Team1_ColorLookup').shaderColor);
 constants[38].fromArray(teams.find(t=>t.name==='CustomColors.Team2_ColorLookup').shaderColor);
 if(low){constants[58].fromArray(source.vector.LightColor);constants[59].x=source.scalar.ENVAmount;}
 else constants[58].x=source.scalar.ENVAmount;
 const uniforms={fieldCB:{value:constants}};
 textures.forEach((t,i)=>uniforms[`field_t${i}`]={value:t});
 let neutralCube;
 if(!low){
  if(!reflectionTexture){neutralCube=new THREE.WebGLCubeRenderTarget(1);reflectionTexture=neutralCube.texture;}
  uniforms.field_t7={value:reflectionTexture};
 }
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 material.name='GroomedGrass_Base_FakeLight_V6_Mat / recovered '+(low?'simplified':'full')+' DXBC';
 material.onBeforeCompile=s=>{
  Object.assign(s.uniforms,uniforms);
  s.vertexShader='varying vec3 fieldWorldUE,fieldViewTS;\nattribute vec4 nativeTangentX,nativeTangentZ;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec3 world=(modelMatrix*vec4(transformed,1.)).xyz;
   vec3 sourceN=nativeTangentZ.xyz;
   vec3 sourceB=cross(sourceN,nativeTangentX.xyz)*nativeTangentZ.w;
   vec3 sourceT=cross(sourceB,sourceN)*nativeTangentZ.w;
   vec3 toEye=(cameraPosition-world).xzy;
   fieldWorldUE=world.xzy*100.;
   fieldViewTS=vec3(dot(toEye,sourceT),dot(toEye,sourceB),dot(toEye,sourceN));`);
  // DXBC samples native Z-up cube coordinates; the WebGL cube is Y-up.
  const code=(low?fieldShader31:fieldShader23).replace(/textureCube\(field_t7,([^;]+?)\.xyz\)/g,'textureCube(field_t7,$1.xzy)');
  s.fragmentShader='varying vec3 fieldWorldUE,fieldViewTS;\n'+code+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','diffuseColor.rgb=recoveredFieldColour(fieldWorldUE,fieldViewTS);diffuseColor.a=1.;');
 };
 material.customProgramCacheKey=()=>`park-field-dxbc-${low?31:23}`;
 material.userData.shaderParity='Original colour instructions, native TBN, source uniforms, sampler slots and team global conversion recovered; capture seam/edge processing tracked separately.';
 withParkFog(material);
 const parts=[];asset.scene.updateMatrixWorld(true);
 asset.scene.traverse(n=>{if(n.isMesh)parts.push((n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(n.matrixWorld));});
 const geometry=new THREE.BufferGeometry();
 for(const name of ['position','normal','tangent']){
  const size=parts[0].getAttribute(name).itemSize;
  const values=new Float32Array(parts.reduce((sum,g)=>sum+g.getAttribute(name).array.length,0));let offset=0;
  for(const part of parts){values.set(part.getAttribute(name).array,offset);offset+=part.getAttribute(name).array.length;}
  geometry.setAttribute(name,new THREE.BufferAttribute(values,size));
 }
 if(nativeTBN.count!==geometry.attributes.position.count)throw new Error('Original field TBN vertex mapping mismatch');
 geometry.setAttribute('nativeTangentX',new THREE.Float32BufferAttribute(nativeTBN.tangentX,4));
 geometry.setAttribute('nativeTangentZ',new THREE.Float32BufferAttribute(nativeTBN.tangentZ,4));
 parts.forEach(g=>g.dispose());
 const mesh=new THREE.Mesh(geometry,material);mesh.name='Grass_Base / original DXBC field';
 mesh.userData.fieldShaderQuality=low?'simplified':'full';
 mesh.userData.setReflectionTexture=t=>{if(uniforms.field_t7)uniforms.field_t7.value=t;neutralCube?.dispose();neutralCube=null;};
 return mesh;
}
