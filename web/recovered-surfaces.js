import * as THREE from 'three';
import {buildingShader,foliageShader,mountainShader} from './recovered-surface-shaders.js';
import {withParkFog} from './park-height-fog.js';

export function createRecoveredSurface(kind,parameters,{texture,cube,diffuse,mask}){
 const building=kind==='building';
 const cb=Array.from({length:96},()=>new THREE.Vector4());
 const materialCB=Array.from({length:5},()=>new THREE.Vector4());
 materialCB[3].set(0,0,0,1); // Normal material pass, no editor material override.
 // Park's global skylight serializes LightingChannels.Static=false. These
 // recovered tree/building components use Static and/or Unnamed_1/Cinematic_1,
 // with no channel shared by that light. Colored sky volumes are saved disabled.
 // Native draws upload per-primitive sky aggregates, not the global brightness.
 // See source-surface-evidence.json for the original tagged channel records.
 const upper=[0,0,0],lower=[0,0,0];
 const skyRegister=building?85:86;
 cb[skyRegister].set(...upper,0);cb[skyRegister+1].set(...lower,0);
 cb[skyRegister+2].set(0,0,0,1); // Static primitive ambient=0, sky contribution enabled.
 if(building){
  cb[57].set(0,0,0,1);
  cb[58].fromArray(parameters.vector.Color);
  cb[59].set(parameters.scalar.ENV??1,parameters.scalar.AOHeight??0,parameters.scalar.LightsOn??1,parameters.scalar.StreetLighting??1);
 }else{
  cb[58].set(0,0,0,1);cb[59].set(parameters.scalar.Brightness??1,0,0,0);
 }
 const uniforms={surfaceCB:{value:cb},surfaceMaterialCB:{value:materialCB},surface_t0:{value:texture}};
 if(building)uniforms.surface_t1={value:cube};
 if(kind==='mountain'){uniforms.surface_t1={value:diffuse};uniforms.surface_t2={value:mask};}
 const varying=`varying vec4 nativeRowX,nativeRowZ;
 varying vec2 sourceUV;
 varying vec3 nativeView,sourceBaked0,sourceBaked1;
 varying vec4 surfaceColor;
 varying float sourceHeight;`;
 const material=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,depthWrite:true,toneMapped:false,
  vertexShader:`attribute vec4 tangent;
   attribute vec4 sourceColor;
   attribute vec3 sourceBakedLight0,sourceBakedLight1;
   ${varying}
   #include <common>
   #include <logdepthbuf_pars_vertex>
   void main(){
    vec3 transformed=position;
    vec3 world=(modelMatrix*vec4(position,1.)).xyz;
    vec3 N=normalize(mat3(modelMatrix)*normal);
    vec3 T=normalize(mat3(modelMatrix)*tangent.xyz);
    vec3 B=cross(N,T)*tangent.w;
    // Batched tangent.w includes the determinant of the Unreal->WebGL Y/Z swap.
    nativeRowX=vec4(T.x,B.x,N.x,0.);
    nativeRowZ=vec4(T.y,B.y,N.y,-tangent.w);
    vec3 eye=cameraPosition-world;
    nativeView=vec3(dot(T,eye),dot(B,eye),dot(N,eye));
    sourceHeight=world.y*100.;sourceUV=uv;surfaceColor=sourceColor;
    sourceBaked0=sourceBakedLight0;sourceBaked1=sourceBakedLight1;
    #include <project_vertex>
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`${varying}
   #include <logdepthbuf_pars_fragment>
   ${building?buildingShader:kind==='mountain'?mountainShader:foliageShader}
   void main(){
    #include <logdepthbuf_fragment>
    vec4 nativeColor=${building?'recoveredBuilding(nativeRowX,nativeRowZ,vec4(sourceUV,0.,0.),vec4(sourceBaked0,0.),vec4(sourceBaked1,0.),vec4(nativeView,1.),vec4(nativeRowZ.xyz,0.),vec4(0.,0.,sourceHeight,1.))':kind==='mountain'?'recoveredMountain(nativeRowX,nativeRowZ,vec4(sourceUV,0.,0.),vec4(sourceBaked0,0.),vec4(sourceBaked1,0.))':'recoveredFoliage(nativeRowX,nativeRowZ,surfaceColor,vec4(sourceUV,0.,0.),vec4(sourceBaked0,0.),vec4(sourceBaked1,0.),vec4(nativeRowZ.xyz,0.))'};
    gl_FragColor=vec4(nativeColor.rgb,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
 });
 material.defaultAttributeValues={sourceColor:[1,1,1,1],sourceBakedLight0:[0,0,0],sourceBakedLight1:[0,0,0]};
 // Three's depth pass must retain the same cutout as the recovered color pass.
 if(kind==='foliage'){material.map=texture;material.alphaTest=.33329999446868896;}
 material.userData.recoveredSurface=kind;
 material.userData.shaderParity='Original directional vertex-lightmap base-pass color; global skylight excluded by saved lighting channels. Native deferred passes and wind remain separate.';
 return withParkFog(material);
}
