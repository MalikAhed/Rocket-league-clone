import * as THREE from 'three';
import {hexglassShader} from './recovered-surface-shaders.js';
import {parkFogGLSL,parkFogUniforms} from './park-height-fog.js';
export function createRecoveredGlass(environment,pattern,properties){
 if(!environment||!pattern)throw new Error('Missing native HexGlass texture');
 const cb=Array.from({length:96},()=>new THREE.Vector4());cb[57].set(0,0,0,1);
 const material=new THREE.ShaderMaterial({
  uniforms:{...parkFogUniforms,surfaceCB:{value:cb},surfaceMaterialCB:{value:Array.from({length:5},()=>new THREE.Vector4())},surface_t0:{value:environment},surface_t1:{value:pattern}},
  transparent:true,depthWrite:false,toneMapped:false,side:properties.TwoSided==='True'?THREE.DoubleSide:THREE.FrontSide,
  vertexShader:`attribute vec4 tangent,sourceColor;varying vec4 sourceColour,nativeFog;varying vec2 nativeUV;varying vec3 viewTS;
   #include <common>
   #include <logdepthbuf_pars_vertex>
   ${parkFogGLSL}
   void main(){
    vec3 world=(modelMatrix*vec4(position,1.)).xyz;
    vec3 n=normalize(mat3(modelMatrix)*normal),t=normalize(mat3(modelMatrix)*tangent.xyz);
    vec3 b=cross(n,t)*tangent.w,eye=cameraPosition-world;
    viewTS=vec3(dot(eye,t),dot(eye,b),dot(eye,n));
    sourceColour=sourceColor;nativeUV=uv;nativeFog=parkHeightFogFactors(world);
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`varying vec4 sourceColour,nativeFog;varying vec2 nativeUV;varying vec3 viewTS;
   #include <logdepthbuf_pars_fragment>
   ${hexglassShader}
   void main(){
    #include <logdepthbuf_fragment>
    gl_FragColor=recoveredHexGlass(sourceColour,vec4(nativeUV,0.,0.),nativeFog,vec4(viewTS,1.));
    #include <colorspace_fragment>
   }`,
 });
 material.defaultAttributeValues={sourceColor:[1,1,1,1]};
 material.userData.parkHeightFog=true;material.userData.nativeTranslucent=true;material.userData.recoveredSurface='hexglass';
 material.userData.shaderParity='Original high-quality dry HexGlass color and opacity, source textures, vertex colors, UVs and vertex fog. Source cooked mip chain remains pending.';
 return material;
}
