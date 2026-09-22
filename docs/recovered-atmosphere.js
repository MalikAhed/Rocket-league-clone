import * as THREE from 'three';
import * as recovered from './recovered-surface-shaders.js';
import {parkFogGLSL,parkFogUniforms} from './park-height-fog.js';
export function createRecoveredAtmosphere(binding,texture,properties){
 if(!texture)throw new Error(`Missing atmosphere texture ${binding.texture}`);
 const cb=Array.from({length:96},()=>new THREE.Vector4());cb[57].set(0,0,0,1);
 const label=binding.shader;
 const args=label==='FogCylinder'?'sourceColour,vec4(nativeUV,0.,0.),nativeFog,vec4(0.,0.,0.,nativeDepth)':'sourceColour,vec4(nativeUV,0.,0.),nativeFog';
 const material=new THREE.ShaderMaterial({
  uniforms:{...parkFogUniforms,surfaceCB:{value:cb},surfaceMaterialCB:{value:Array.from({length:5},()=>new THREE.Vector4())},surface_t0:{value:texture}},
  side:properties.TwoSided==='True'?THREE.DoubleSide:THREE.FrontSide,transparent:true,depthWrite:false,toneMapped:false,
  vertexShader:`attribute vec4 sourceColor;varying vec4 sourceColour,nativeFog;varying vec2 nativeUV;varying float nativeDepth;
   #include <common>
   #include <logdepthbuf_pars_vertex>
   ${parkFogGLSL}
   void main(){
    vec3 world=(modelMatrix*vec4(position,1.)).xyz;
    vec4 view=viewMatrix*vec4(world,1.);
    sourceColour=sourceColor;nativeUV=uv;nativeDepth=-view.z*100.;
    nativeFog=parkHeightFogFactors(world);
    gl_Position=projectionMatrix*view;
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`varying vec4 sourceColour,nativeFog;varying vec2 nativeUV;varying float nativeDepth;
   #include <logdepthbuf_pars_fragment>
   ${recovered[label.toLowerCase()+'Shader']}
   void main(){
    #include <logdepthbuf_fragment>
    gl_FragColor=recovered${label}(${args});
    #include <colorspace_fragment>
   }`,
 });
 if(properties.BlendMode==='BLEND_Additive'){
  // Native additive pixel output already contains its opacity multiplication.
  material.blending=THREE.CustomBlending;material.blendSrc=THREE.OneFactor;material.blendDst=THREE.OneFactor;
 }
 material.defaultAttributeValues={sourceColor:[1,1,1,1]};
 material.userData.parkHeightFog=true;
 material.userData.recoveredSurface='atmosphere';material.userData.nativeTranslucent=true;
 material.userData.shaderParity='Original color, opacity and vertex fog; source component colors, transform and sorting. Main-view bloom remains separate.';
 return material;
}
