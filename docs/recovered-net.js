import * as THREE from 'three';
import {netShader} from './recovered-surface-shaders.js';
import {parkFogGLSL,parkFogUniforms} from './park-height-fog.js';
const ball={value:new THREE.Vector4(0,0,0,1)},time={value:0};
export function updateNetBall(x,y,z){ball.value.set(x,y,z,1);}
export function updateNetTime(seconds){time.value=seconds;}
export function createRecoveredNet(parameters,texture,tracker){
 if(!texture||!tracker)throw new Error('Original Park fence requires Net_D and Hexagons_Pack_01_T');
 const p=parameters.scalar,cb=Array.from({length:96},()=>new THREE.Vector4());
 cb[58].set(0,0,0,1);cb[59]=ball.value;
 cb[60].set(p.Emissive??.25,p.Radius??64,p.Hardness??.03999999910593033,p['Outer ring width']??.5);
 cb[61].set(p['BallTech outer ring brightness']??.4000000059604645,p['Ball effect tiling']??3,p.HighlightRadius??64,p['BallTech hexagon brightness']??.4000000059604645);
 const material=new THREE.ShaderMaterial({
  uniforms:{...parkFogUniforms,surfaceCB:{value:cb},surfaceMaterialCB:{value:Array.from({length:5},()=>new THREE.Vector4())},surface_t0:{value:texture},surface_t1:{value:tracker},netTime:time},
  side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false,
  vertexShader:`attribute vec4 sourceColor;
   uniform float netTime;
   varying vec2 nativeUV;
   varying vec3 nativeWorld;
   varying vec4 nativeFog;
   #include <common>
   #include <logdepthbuf_pars_vertex>
   ${parkFogGLSL}
   void main(){
    vec3 world=(modelMatrix*vec4(position,1.)).xyz;
    vec3 native=world.xzy*100.;
    vec2 phase=(native.yx*.0001250000059371814+netTime*.75)*6.2831854820251465;
    native+=vec3(cos(phase.x),sin(phase.y),cos(phase.x))*sourceColor.a*16.;
    nativeWorld=native;world=native.xzy*.01;nativeUV=uv;
    nativeFog=parkHeightFogFactors(world);
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`varying vec2 nativeUV;varying vec3 nativeWorld;varying vec4 nativeFog;
   #include <logdepthbuf_pars_fragment>
   ${netShader}
   void main(){
    #include <logdepthbuf_fragment>
    gl_FragColor=recoveredNet(vec4(nativeUV,0.,0.),nativeFog,vec4(nativeWorld,1.));
    #include <colorspace_fragment>
   }`,
 });
 material.defaultAttributeValues={sourceColor:[1,1,1,0]};
 material.userData.parkHeightFog=true; // Native translucent pass interpolates vertex fog.
 material.userData.recoveredSurface='net';
 material.userData.shaderParity='Original Park fence color/opacity, native vertex wind and ball-proximity inputs; source mips/runtime phase remain separate.';
 return material;
}
