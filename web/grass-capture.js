import * as THREE from 'three';
import {sourceAssets} from './source-materials.js';
import {createGrassCaptureDOF} from './grass-capture-dof.js';

// Original source-position capture and recovered fully blurred DOF64 stage.
export async function createGrassCapture(renderer){
 const response=await fetch('./assets/original/grass-capture-settings.json');
 if(!response.ok)throw new Error(`Grass capture settings: HTTP ${response.status}`);
 const settings=await response.json(),size=Number(settings.effectiveTargetProperties.SizeX),basis=settings.viewerBasis;
 const target=new THREE.WebGLCubeRenderTarget(size,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,colorSpace:THREE.SRGBColorSpace,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false,depthBuffer:true});
 const postprocess=createGrassCaptureDOF(settings);
 const texture=target.texture;texture.name='Grass_Textures.GrassCube · source-position DOF64 capture';
 const camera=new THREE.CubeCamera(basis.near,basis.far,target);camera.name='Original GrassCube capture';camera.position.fromArray(basis.position);
 let captured=false,inFlight=null,disposed=false;
 const fidelity={source:'Grass_Textures.GrassCube',status:'neutral before capture',originalPostProcess:settings.effectivePostProcessProperties,
  recoveredPostProcess:postprocess.evidence,
  missing:['Native filter padding and cube-edge roughness','Native CubeMapVisibleOnly helper shaders and visibility hooks','Ground is currently omitted to prevent recursive reflection; this exclusion is not serialized in the source capture','Exact native capture gamma/forced-linear resource flags','Native capture scheduler: this port captures once after static asset assembly'],
  sampleBasis:'Native UE direction (x,y,z) -> textureCube direction (x,z,y); render-target cube needs no additional X flip',captureCount:0};
 texture.userData.sourceCapture=fidelity;
 const save=()=>({target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),clear:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,shadows:renderer.shadowMap.enabled,xr:renderer.xr.enabled,toneMapping:renderer.toneMapping,toneMappingExposure:renderer.toneMappingExposure});
 const restore=s=>{renderer.setRenderTarget(s.target,s.face,s.mip);renderer.setClearColor(s.clear,s.alpha);renderer.autoClear=s.autoClear;renderer.shadowMap.enabled=s.shadows;renderer.xr.enabled=s.xr;renderer.toneMapping=s.toneMapping;renderer.toneMappingExposure=s.toneMappingExposure;};
 // All six faces exist and are opaque black (the source ClearColor), making
 // the same texture safe to bind before its one deferred scene capture.
 const initial=save();
 try{renderer.setClearColor(0x000000,1);for(let face=0;face<6;face++){renderer.setRenderTarget(target,face);renderer.clear(true,true,true);}}
 finally{restore(initial);}
 function capture(scene,ground,{force=false}={}){
  if(disposed)return Promise.reject(new Error('Grass capture is disposed'));
  if(captured&&!force)return Promise.resolve(texture);
  return inFlight??=(async()=>{
   // Call only after addArena/addScenery and other static scene assembly have
   // finished. Their queued source textures must also finish before rendering.
   const assets=await sourceAssets();await assets.whenTexturesReady();
   if(disposed)throw new Error('Grass capture is disposed');
   const state=save(),groundVisible=ground?.visible;
   try{
    if(ground)ground.visible=false;
    renderer.shadowMap.enabled=false;renderer.xr.enabled=false;renderer.autoClear=true;
    renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
    renderer.setClearColor(0x000000,1);scene.updateMatrixWorld(true);postprocess.render(renderer,scene,camera,target);
    captured=true;fidelity.captureCount++;fidelity.status='source-position capture with recovered original DOF64 filter';
    return texture;
   }finally{if(ground)ground.visible=groundVisible;restore(state);}
  })().finally(()=>{inFlight=null;});
 }
 return {texture,camera,target,settings,fidelity,capture,get captured(){return captured;},dispose(){disposed=true;target.dispose();postprocess.dispose();}};
}
