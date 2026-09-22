import * as THREE from 'three';

// RocketLeague.exe 0xA6A7C0: normalized Gaussian samples, paired for bilinear
// filtering. The parameter is variance, not sigma or a full-resolution radius.
export function originalCaptureKernel(blurKernelSize,viewWidth){
 const variance=Math.min(15,Math.max(.00001,blurKernelSize*(viewWidth/1280)/4));
 // cvtss2si(-.5-2*variance), arithmetic shift right, then negate.
 const support=Math.min(15,-(Math.round(-.5-2*variance)>>1));
 const taps=[];let total=0;
 for(let x=-support;x<=support;x+=2){
  const a=Math.exp(-x*x/(2*variance)),b=x===support?0:Math.exp(-(x+1)*(x+1)/(2*variance));
  const weight=a+b;taps.push({offset:x+b/weight,weight});total+=weight;
 }
 for(const tap of taps)tap.weight/=total;
 return {variance,support,taps};
}

export function createGrassCaptureDOF(settings){
 const size=Number(settings.effectiveTargetProperties.SizeX),props=settings.effectivePostProcessProperties;
 if(props.MinBlurAmount!==1)throw new Error('Recovered GrassCube DOF requires the source fully blurred capture');
 const kernel=originalCaptureKernel(props.BlurKernelSize,size),quarter=size/4;
 const makeTarget=(width,depthBuffer=false)=>{
  const target=new THREE.WebGLRenderTarget(width,width,{type:THREE.HalfFloatType,depthBuffer,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  target.texture.colorSpace=THREE.LinearSRGBColorSpace;return target;
 };
 const raw=makeTarget(size,true),half=makeTarget(size/2),gather=makeTarget(quarter),horizontal=makeTarget(quarter),vertical=makeTarget(quarter);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const sampleUniforms={inputTexture:{value:null}};
 const downsample=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader,uniforms:sampleUniforms,
  // At half-size pixel centers, bilinear sampling averages exactly2x2 input
  // texels. Two stages reproduce the source half-res plus four-sample gather.
  fragmentShader:'varying vec2 vUv;uniform sampler2D inputTexture;void main(){gl_FragColor=vec4(texture2D(inputTexture,vUv).rgb,1.);}'});
 const blur=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader,
  uniforms:{inputTexture:{value:null},axis:{value:new THREE.Vector2()}},
  fragmentShader:`varying vec2 vUv;uniform sampler2D inputTexture;uniform vec2 axis;void main(){vec3 c=vec3(0.);${kernel.taps.map(t=>`c+=texture2D(inputTexture,vUv+axis*${t.offset.toPrecision(12)}).rgb*${t.weight.toPrecision(12)};`).join('')}gl_FragColor=vec4(c,1.);}`});
 const resolve=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader,uniforms:{inputTexture:{value:vertical.texture}},
  fragmentShader:'varying vec2 vUv;uniform sampler2D inputTexture;void main(){gl_FragColor=vec4(texture2D(inputTexture,vUv).rgb,1.);\n#include <colorspace_fragment>\n}'});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),downsample);quad.frustumCulled=false;scene.add(quad);
 const pass=(renderer,material,target,face=0)=>{quad.material=material;renderer.setRenderTarget(target,face);renderer.render(scene,camera);};
 const evidence={kernel,downsampleFactor:4,sourceReferenceWidth:1280,filterResolution:quarter,
  native:['0xA81FAD: downsample4','0xA6EB90: kernel scale viewWidth/1280/4','0xA6A7C0: normalized paired Gaussian'],
  shader:'TDOFGatherPixelShader and FDOFAndBloomBlendPixelShader; MinBlur1 removes sharp color, quarter encoding cancels during final normalization',
  bloom:'Bloom buffer2 is optimized out of the installed classic final blend DXBC; only DOF buffer1 is sampled',
  remaining:['Native two-pixel filter-buffer padding and cube-edge roughness handling are not replicated exactly']};
 return {evidence,
  render(renderer,world,cubeCamera,target){
   if(cubeCamera.coordinateSystem!==renderer.coordinateSystem){cubeCamera.coordinateSystem=renderer.coordinateSystem;cubeCamera.updateCoordinateSystem();}
   cubeCamera.updateMatrixWorld(true);
   for(let face=0;face<6;face++){
    renderer.setRenderTarget(raw);renderer.render(world,cubeCamera.children[face]);
    sampleUniforms.inputTexture.value=raw.texture;pass(renderer,downsample,half);
    sampleUniforms.inputTexture.value=half.texture;pass(renderer,downsample,gather);
    blur.uniforms.inputTexture.value=gather.texture;blur.uniforms.axis.value.set(1/quarter,0);pass(renderer,blur,horizontal);
    blur.uniforms.inputTexture.value=horizontal.texture;blur.uniforms.axis.value.set(0,1/quarter);pass(renderer,blur,vertical);
    pass(renderer,resolve,target,face);
   }
  },
  dispose(){for(const target of [raw,half,gather,horizontal,vertical])target.dispose();for(const material of [downsample,blur,resolve])material.dispose();quad.geometry.dispose();}
 };
}
