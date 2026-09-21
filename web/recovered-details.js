import * as THREE from 'three';
import {frameShader,flagShader,framefadeShader,framewsrShader,lensShader} from './recovered-surface-shaders.js';
import {parkFogGLSL,parkFogUniforms} from './park-height-fog.js';
const blank=new THREE.CubeTexture(Array.from({length:6},()=>new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1)));
blank.needsUpdate=true;blank.generateMipmaps=false;blank.minFilter=THREE.LinearFilter;
const reflection={value:blank},time={value:0};
export const detailReflection=reflection,detailTime=time;
export function setDetailReflection(texture){reflection.value=texture;}
export function updateDetailTime(seconds){time.value=seconds;}
export function createRecoveredDetail(kind,parameters,textures,teams,lighting){
 const cb=Array.from({length:96},()=>new THREE.Vector4()),viewCB=Array.from({length:5},()=>new THREE.Vector4()),materialCB=Array.from({length:5},()=>new THREE.Vector4());materialCB[3].set(0,0,0,1);
 for(const [slot,value]of Object.entries(teams.registers))cb[Number(slot)].fromArray(value);
 cb[57].set(0,0,0,1);cb[58].set(0,0,0,1);
 if(kind==='Frame'||kind==='FrameWSR'){
  if(lighting?.lightMapType!==2)throw new Error('Frame requires original texture lightmap binding');
  cb[58].x=parameters.scalar.ENVAmount??4;
  cb[87].set(...lighting.slots[0].scale,0);cb[88].set(...lighting.slots[1].scale,0);
  if(kind==='FrameWSR')cb[58].set(parameters.scalar.Brightness??1,parameters.scalar.ENVAmount??16,(parameters.scalar.ENVAmount??16)*.5,0);
 }
 const uniforms={...parkFogUniforms,surfaceCB:{value:cb},surfaceViewCB:{value:viewCB},surfaceMaterialCB:{value:materialCB}};
 textures.forEach((t,i)=>uniforms['surface_t'+i]={value:t});
 if(kind==='Frame')uniforms.surface_t6=reflection;
 if(kind==='FrameWSR')uniforms.surface_t7=reflection;
 if(kind==='Lens'){uniforms.surface_t1=reflection;cb[58].x=parameters.scalar.DesaturateLenses??0;}
 if(kind==='Flag'){uniforms.surface_t2=reflection;cb[59].y=parameters.scalar.ENVAmount??.25;}
 const code=({Frame:frameShader,Flag:flagShader,FrameFade:framefadeShader,FrameWSR:framewsrShader,Lens:lensShader}[kind]).replace(/textureCube\(surface_t(6|2|7|1),([^;]+?)\.xyz\)/g,'textureCube(surface_t$1,$2.xzy)');
 const args={Frame:'rowX,rowZ,vec4(lightUV,0.,0.),vec4(materialUV,0.,0.),vec4(relativeUE,1.)',FrameWSR:'rowX,rowZ,vec4(lightUV,0.,0.),vec4(materialUV,0.,0.),vec4(viewTS,1.),vec4(relativeUE,1.)',Lens:'rowX,rowZ,vec4(materialUV,0.,0.),vertexFog,vertexColor,vec4(relativeUE,1.)',Flag:'rowX,rowZ,vec4(materialUV,0.,0.),vec4(baked0,0.),vec4(baked1,0.),vec4(viewTS,1.),vec4(relativeUE,1.)',FrameFade:'vec4(materialUV,0.,0.),vec4(baked0,0.),vec4(baked1,0.),vertexFog,vec4(viewTS,1.),vec4(relativeUE,1.)'}[kind];
 const varying='varying vec4 rowX,rowZ,vertexFog,vertexColor;varying vec3 relativeUE,viewTS,baked0,baked1;varying vec2 materialUV,lightUV;';
 const transparent=kind==='FrameFade'||kind==='Lens';
 const material=new THREE.ShaderMaterial({uniforms,side:kind==='Flag'?THREE.DoubleSide:THREE.FrontSide,transparent,depthWrite:!transparent,toneMapped:false,
  vertexShader:`attribute vec4 tangent,sourceColor;attribute vec2 sourceLightmapUV;attribute vec3 sourceBakedLight0,sourceBakedLight1;${varying}
   #include <common>
   #include <logdepthbuf_pars_vertex>
   ${parkFogGLSL}
   void main(){
    vec3 world=(modelMatrix*vec4(position,1.)).xyz;parkWorldPosition=world;
    vec3 n=normalize(mat3(modelMatrix)*normal),t=normalize(mat3(modelMatrix)*tangent.xyz),b=cross(n,t)*tangent.w;
    rowX=vec4(t.x,b.x,n.x,0.);rowZ=vec4(t.y,b.y,n.y,-tangent.w);
    vec3 eye=cameraPosition-world;viewTS=vec3(dot(t,eye),dot(b,eye),dot(n,eye));
    relativeUE=(world-cameraPosition).xzy*100.;materialUV=uv;lightUV=sourceLightmapUV;
    baked0=sourceBakedLight0;baked1=sourceBakedLight1;vertexFog=parkHeightFogFactors(world);vertexColor=sourceColor;
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`${varying}
   #include <logdepthbuf_pars_fragment>
   ${parkFogGLSL}
   ${code}
   void main(){
    #include <logdepthbuf_fragment>
    gl_FragColor=recovered${kind}(${args});
    ${transparent?'':'gl_FragColor=vec4(applyParkHeightFog(gl_FragColor.rgb),1.);'}
    #include <colorspace_fragment>
   }`,
 });
 const cameraPoint=new THREE.Vector3(),direction=new THREE.Vector3();
 material.onBeforeRender=(renderer,scene,camera)=>{
  cameraPoint.setFromMatrixPosition(camera.matrixWorld);cb[26].set(cameraPoint.x*100,cameraPoint.z*100,cameraPoint.y*100,0);cb[27].copy(cb[26]);
  if(kind==='Flag')cb[59].x=time.value;
  if(transparent||kind==='FrameWSR'){direction.setFromMatrixColumn(camera.matrixWorld,2).normalize().negate();viewCB[0].w=direction.x;viewCB[1].w=direction.z;viewCB[2].w=direction.y;viewCB[3].w=0;}
 };
 material.defaultAttributeValues={sourceColor:[1,1,1,1],sourceLightmapUV:[0,0],sourceBakedLight0:[0,0,0],sourceBakedLight1:[0,0,0]};
 material.userData.parkHeightFog=true;material.userData.recoveredSurface=kind.toLowerCase();material.userData.nativeTranslucent=transparent;
 material.userData.shaderParity='Recovered source material color with original packed channels, team globals and matching lightmap policy. Native wind, shadow/reflection scheduling and cooked mips remain separate.';
 return material;
}
