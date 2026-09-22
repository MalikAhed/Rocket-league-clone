import * as THREE from 'three';
import {gameplayPostUniforms,gameplayPostGLSL,updateGameplayPost} from './gameplay-postfx.js';

import {parkLightingPipeline} from './park-render-data.js';
export {parkLightingPipeline};
const effect = {...parkLightingPipeline.uberClassDefaults, ...parkLightingPipeline.uberEffect};
const world = parkLightingPipeline.worldPostProcess;
const worldDefaults=parkLightingPipeline.postProcessStructDefaults;
const setting=(suffix,effectName)=>
  (world[`bOverride_Scene_${suffix}`]??worldDefaults[`bOverride_Scene_${suffix}`])==='True'
    ? (world[`Scene_${suffix}`]??worldDefaults[`Scene_${suffix}`]) : effect[effectName];
export const parkGradingSettings=Object.freeze({
  shadows:setting('Shadows','SceneShadows'),highlights:setting('HighLights','SceneHighLights'),
  midtones:setting('MidTones','SceneMidTones'),desaturation:setting('Desaturation','SceneDesaturation'),
  colorize:setting('Colorize','SceneColorize'),...parkLightingPipeline.nativeGrading.runtimeDefaults,
});
export const parkToneSettings = Object.freeze({
  scale: world.bOverride_Scene_TonemapperScale === 'True' ? world.Scene_TonemapperScale : effect.TonemapperScale,
  range: effect.TonemapperRange,
  toe: effect.TonemapperToeFactor,
});

// Original native CPU setup: RocketLeague.exe RVA 0x5BE960.
export function parkToneParameters({scale, range, toe} = parkToneSettings) {
  const gain = Math.max(parkLightingPipeline.nativeTonemapper.scaleEpsilon, scale);
  const a = parkLightingPipeline.nativeTonemapper.rationalCoefficient / gain;
  const b = (range + a) / range;
  return {curve: [a, b, Math.sqrt(b * a / gain) - a, gain], toe: THREE.MathUtils.clamp(toe, 0, 1)};
}

// Original FUberPostProcessBlendPixelShader02000 DXBC at byte 2226515.
// This stage returns display-space RGB; no additional sRGB encoding follows.
// The game's grading LUT is sampled after this curve; bloom/grain are separate.
export const parkToneGLSL = `
uniform vec4 parkToneCurve;
uniform float parkToneToe;
vec3 applyParkToneMap(vec3 colour) {
  vec3 c=clamp(colour,vec3(0.),vec3(65503.));
  vec3 rational=c/abs(c+parkToneCurve.x)*parkToneCurve.y;
  vec3 lowEnd=pow(c*parkToneCurve.w,vec3(1./2.2));
  vec3 atCutoff=clamp((c-parkToneCurve.z)*10000.,0.,1.);
  vec3 toeCurve=mix(lowEnd,rational,atCutoff);
  return clamp(mix(toeCurve,rational,parkToneToe),0.,1.);
}`;

// Original FLUTBlenderPixelShader<1>, CPU setters at RVAs 0x4E4FF0/0x4E52D0.
// Native target allocation is 256x16 PF_A8R8G8B8: preserve its 8-bit quantization.
export function createParkGradingLUT(settings=parkGradingSettings) {
  const data=new Uint8Array(256*16*4);
  const {shadows,highlights,midtones,desaturation,colorize,displayGamma,viewColorScale,fadeColor,fadeAmount}=settings;
  for(let b=0;b<16;b++)for(let g=0;g<16;g++)for(let r=0;r<16;r++){
    const c=[r,g,b].map((value,i)=>Math.pow(Math.max(0,THREE.MathUtils.clamp(value/15-shadows[i],0,1)/highlights[i]),midtones[i]));
    const grey=(c[0]*.3+c[1]*.59+c[2]*.11)*desaturation;
    const offset=(g*256+b*16+r)*4;
    for(let i=0;i<3;i++){
      const graded=(c[i]*(1-desaturation)+grey);
      const faded=(graded*viewColorScale[i]*(1-fadeAmount)+fadeColor[i]*fadeAmount)*colorize[i];
      data[offset+i]=Math.round(THREE.MathUtils.clamp(Math.pow(Math.max(0,faded),2.2/Math.max(.0001,displayGamma)),0,1)*255);
    }
    data[offset+3]=255;
  }
  const texture=new THREE.DataTexture(data,256,16,THREE.RGBAFormat,THREE.UnsignedByteType);
  texture.colorSpace=THREE.NoColorSpace;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;texture.needsUpdate=true;
  texture.name='Park authored grading LUT, recovered 16-cube layout';
  return texture;
}

export const parkGradingGLSL=`
uniform sampler2D parkGradingLUT;
vec3 applyParkGrading(vec3 c){
  float slice=floor(c.b*14.9999);
  vec2 uv=vec2(slice*.0625+c.r*.05859375+.001953125,c.g*.9375+.03125);
  vec3 lower=texture2D(parkGradingLUT,uv).rgb;
  vec3 upper=texture2D(parkGradingLUT,uv+vec2(.0625,0.)).rgb;
  return mix(lower,upper,c.b*15.-slice);
}`;

// Optional single-pass HDR resolve. Keeping it after scene rendering preserves
// linear blending of transparent surfaces. Parent viewer opts in explicitly.
export function createParkToneMapper(renderer) {
  const params = parkToneParameters();
  const target = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true,stencilBuffer:false});
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  target.texture.name = 'Park linear HDR scene';
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const gradingLUT=createParkGradingLUT();
  const material = new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{...gameplayPostUniforms,sceneColour:{value:target.texture},parkToneCurve:{value:new THREE.Vector4(...params.curve)},parkToneToe:{value:params.toe},parkGradingLUT:{value:gradingLUT}},
    vertexShader:'varying vec2 screenUv;void main(){screenUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 screenUv;uniform sampler2D sceneColour;${parkToneGLSL}${parkGradingGLSL}${gameplayPostGLSL}
      void main(){gl_FragColor=vec4(applyParkGrading(applyParkToneMap(gameplaySceneColour(sceneColour,screenUv))),1.);}`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  quad.frustumCulled=false;scene.add(quad);
  const size=new THREE.Vector2();
  const stats={drawCalls:0,triangles:0,points:0,lines:0};
  return {
    stats,
    evidence:'Recovered authored tone-map and grading LUT; normal view gamma/color scale/fade defaults, remaining effects separate.',
    render(worldScene,worldCamera) {
      renderer.getDrawingBufferSize(size);
      if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);
      const previousTarget=renderer.getRenderTarget();
      const previousToneMapping=renderer.toneMapping;
      const previousInfoAutoReset=renderer.info.autoReset;
      renderer.info.autoReset=false;renderer.info.reset();
      renderer.toneMapping=THREE.NoToneMapping;
      try {
        renderer.setRenderTarget(target);renderer.render(worldScene,worldCamera);
        updateGameplayPost(worldCamera);
        renderer.setRenderTarget(previousTarget);renderer.render(scene,camera);
        Object.assign(stats,{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,lines:renderer.info.render.lines});
      } finally {
        renderer.setRenderTarget(previousTarget);renderer.toneMapping=previousToneMapping;
        renderer.info.autoReset=previousInfoAutoReset;
      }
    },
    dispose(){target.dispose();gradingLUT.dispose();quad.geometry.dispose();material.dispose();},
  };
}
