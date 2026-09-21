import {tierTextureURL} from './texture-tiers.js';
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { addArena } from './arena.js';
import { createPlay } from './rocket-play.js?v=map-only-1';
import {setupBindings} from './bindings.js';
import {addScenery} from './scenery.js';
import {originalGround} from './recovered-ground.js';
import {addOriginalDaylight} from './original-environment.js';
import {sourceAssets} from './source-materials.js';
import {createParkToneMapper} from './park-tonemapping.js';
import {createGrassCapture} from './grass-capture.js';
import {updateNetTime} from './recovered-net.js';
import {setDetailReflection,updateDetailTime} from './recovered-details.js';
import {createFrameMeter} from './frame-meter.js';
import {createRenderScheduler} from './render-scheduler.js';
import {createQualityPresets} from './quality-presets.js';
import {createGameMenu} from './game-menu.js?v=map-only-1';
import {optimizeSceneUniforms} from './compact-uniforms.js';
setupBindings();
const gameMenu=createGameMenu();
let originalReflectionReady=tierTextureURL('./assets/original/NativeVehicle__body_grain__Body_Grain_D.png').indexOf('/quality/')<0;
const canvas=document.querySelector('#scene');
const viewport=document.querySelector('#viewport');
const benchmarkMode=new URLSearchParams(location.search).has('benchmarkPresets');
let benchmarkRunning=false;
if(benchmarkMode){viewport.style.width='1280px';viewport.style.height='684px';viewport.style.flex='none';viewport.style.minHeight='684px';}
const status=document.querySelector('#status');
const readyParts=new Set();
canvas.dataset.loadState='loading';canvas.dataset.shaderErrors='0';
function loadFailed(error){
 gameMenu.error(error);
 canvas.dataset.loadState='error';status.hidden=false;
 status.textContent=`Unable to finish loading: ${error.message??error}`;console.error(error);
}
function partReady(part){
 readyParts.add(part);
 if(!new URLSearchParams(location.search).has('baselineUniforms'))optimizeSceneUniforms(scene);
 if(readyParts.size===3&&canvas.dataset.loadState!=='error'){
  canvas.dataset.loadState='ready';status.hidden=true;
  gameMenu.ready();
  createQualityPresets(scene,ground,canvas,{onTextureQuality:async quality=>{
   if(quality==='realistic'&&!originalReflectionReady){await (await grassCaptureReady).capture(scene,ground,{force:true});originalReflectionReady=true;}
  }}).then(async quality=>{
   if(benchmarkMode){const {benchmarkPresets}=await import('./benchmark-presets.js');benchmarkRunning=true;try{await benchmarkPresets(quality,canvas);}finally{benchmarkRunning=false;viewport.style.width='';viewport.style.height='';viewport.style.flex='';viewport.style.minHeight='';resize();}}
  }).catch(loadFailed);
 }
}
// Geometry is drawn into the HDR target (samples=0). The canvas receives only
// a full-screen color resolve; canvas MSAA cannot smooth the scene's edges.
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
canvas.dataset.canvasMsaa=String(renderer.getContext().getContextAttributes().antialias);
renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
 canvas.dataset.shaderErrors=String(Number(canvas.dataset.shaderErrors)+1);
 loadFailed(new Error(`Map shader failed: ${gl.getProgramInfoLog(program)} ${gl.getShaderInfoLog(vertex)} ${gl.getShaderInfoLog(fragment)}`));
};
const renderScaleOverride=Number(new URLSearchParams(location.search).get('scale'));
renderer.setPixelRatio(renderScaleOverride>=.4&&renderScaleOverride<=1?renderScaleOverride:new URLSearchParams(location.search).has('reference')?.85:.6);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=false;
renderer.setClearColor('#9eb7c9');
const parkToneMapper=createParkToneMapper(renderer);
const scene=new THREE.Scene();
const grassCaptureReady=createGrassCapture(renderer);
const daylight=addOriginalDaylight(scene,renderer).catch(loadFailed);
const camera=new THREE.PerspectiveCamera(42,1,.1,1000);
const controls=new OrbitControls(camera,canvas);
let free=false;let dragging=false;let yaw=0;let pitch=0;const keys=new Set();
let play,ground;
const referenceMode=new URLSearchParams(location.search).has('reference');
const mapOnly=new URLSearchParams(location.search).has('mapOnly');
function referenceView(){
 if(play?.active)playButton.click();
 free=false;keys.clear();controls.enabled=true;controls.enableDamping=false;
 camera.up.set(0,1,0);camera.fov=65;camera.position.set(-27,9,-51);
 controls.target.set(17,3,35);camera.updateProjectionMatrix();controls.update();
 hint.textContent='Reference view · Blue-side right corner · Drag to inspect';
}
controls.enableDamping=true; controls.minDistance=8; controls.maxDistance=260;
controls.maxPolarAngle=Math.PI*.49;
function reset(){
 const distance=viewport.clientWidth/viewport.clientHeight<.9?215:145;
 camera.position.set(distance*.52,distance*.65,distance*.62);
 controls.target.set(0,0,0);controls.update();
}
function resize(){
 renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);
 camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);resize();reset();
document.querySelector('#render-scale').addEventListener('change',e=>{renderer.setPixelRatio(Number(e.target.value));resize();});
for(const option of document.querySelector('#render-scale').options)option.selected=Number(option.value)===renderer.getPixelRatio();
let fpsCap=0,lastFrame=0;
const fpsInput=document.querySelector('#fps-cap');fpsInput.value=fpsCap;
fpsInput.addEventListener('input',()=>{fpsCap=Math.max(0,Math.min(360,Number(fpsInput.value)||0));localStorage.setItem('beckwith.fpsCap',String(fpsCap));});
document.querySelector('#fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
document.querySelector('#reset').addEventListener('click',()=>{
 keys.clear();dragging=false;
 if(play?.active){play.reset();return;}
 if(free){camera.position.set(0,2.2,30);yaw=0;pitch=0;updateLook();}else reset();
});
try {
 ground=await originalGround({reflectionTexture:(await grassCaptureReady).texture});scene.add(ground);
 status.textContent='Loading original arena…';
 const arenaCount=await addArena(scene,renderer);
 status.textContent=`Arena loaded · ${arenaCount} objects`;
 canvas.dataset.source='Park_P.upk: Grass_Base + recovered original field DXBC';
 canvas.dataset.fieldShader=ground.userData.fieldShaderQuality;
 canvas.dataset.triangles=String(ground.geometry.attributes.position.count/3);
 partReady('arena');
}catch(error){loadFailed(error);}
const freeButton=document.querySelector('#free');
const hint=document.querySelector('.hint');
const playButton=document.querySelector('#play');
if(mapOnly){
 playButton.hidden=true;
 document.querySelector('#controls-open').hidden=true;
 document.querySelector('#camera-open').hidden=true;
 document.querySelector('#freeplay-tools').hidden=true;
}
addScenery(scene,camera).then(async count=>{
 await daylight;await (await sourceAssets()).whenTexturesReady();
 if(ground&&ground.userData.fieldShaderQuality==='full'){
  const capture=await grassCaptureReady;await capture.capture(scene,ground);setDetailReflection(capture.texture);canvas.dataset.grassCapture=capture.fidelity.status;
 }
 renderer.shadowMap.needsUpdate=true;document.querySelector('.eyebrow').textContent='DAY · ORIGINAL ASSETS';
 canvas.dataset.sourceInstances=String(scene.children.reduce((sum,node)=>sum+(node.userData.sourceInstanceCount??0),0));
 partReady('scenery');
}).catch(loadFailed);
THREE.DefaultLoadingManager.onLoad=()=>{renderer.shadowMap.needsUpdate=true;};
createPlay(scene,camera,canvas).then(p=>{play=p;play.setActive(false);if(mapOnly)play.mapOnly();else gameMenu.bind(play);controls.enabled=mapOnly||false;playButton.disabled=false;playButton.textContent='Drive Fennec';if(referenceMode)referenceView();else if(new URLSearchParams(location.search).has('effectsChecks')||new URLSearchParams(location.search).has('cameraChecks'))playButton.click();partReady('play');}).catch(e=>{playButton.textContent='Car/physics failed to load';loadFailed(e);});
document.querySelector('#reference-view').addEventListener('click',referenceView);
playButton.addEventListener('click',()=>{
 if(!play)return;play.setActive(!play.active);free=false;keys.clear();controls.enabled=!play.active;
 freeButton.disabled=play.active;freeButton.textContent='Move inside';playButton.textContent=play.active?'Stop driving':'Drive Fennec';
 hint.textContent=play.active?'Your Rocket League bindings · Controls to remap · Camera for camera settings':'Drag to orbit · Scroll to zoom · Right-drag to pan';
 if(!play.active){camera.up.set(0,1,0);camera.fov=42;camera.updateProjectionMatrix();reset();}
});
function updateLook(){camera.quaternion.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));}
freeButton.addEventListener('click',()=>{
 free=!free;controls.enabled=!free;freeButton.textContent=free?'Orbit view':'Move inside';
 keys.clear();dragging=false;
 if(free){camera.position.set(0,2.2,30);yaw=0;pitch=0;updateLook();hint.textContent='Drag to look · WASD move · Q/E down/up · Shift faster';}
 else {hint.textContent='Drag to orbit · Scroll to zoom · Right-drag to pan';reset();}
});
canvas.addEventListener('pointerdown',e=>{if(free){dragging=true;canvas.setPointerCapture(e.pointerId);canvas.focus();}});
canvas.addEventListener('pointerup',()=>dragging=false);
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('pointermove',e=>{if(free&&dragging){yaw-=e.movementX*.004;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.004,-1.5,1.5);updateLook();}});
window.addEventListener('keydown',e=>{if(free&&['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();dragging=false});
const clock=new THREE.Clock();
const frameMeter=createFrameMeter(renderer,canvas);
const renderScheduler=createRenderScheduler(renderer,()=>{
 frameMeter.begin();
 const dt=Math.min(clock.getDelta(),.05);
 gameMenu.update();
 updateNetTime(clock.elapsedTime);
 updateDetailTime(clock.elapsedTime);
 if(play?.active){if(!benchmarkRunning)play.update(dt);}
 else if(free){
  const move=new THREE.Vector3(Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),0,Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp')));
  move.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);move.y=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
  if(move.lengthSq())camera.position.addScaledVector(move.normalize(),dt*(keys.has('ShiftLeft')||keys.has('ShiftRight')?25:9));
  camera.position.y=Math.max(.5,camera.position.y);
 }else if(play?.updatePreview&&!referenceMode)play.updatePreview(dt);else controls.update();
 // Simulate at the normal browser cadence; cap rendering only.
 const frameNow=performance.now();
 if(fpsCap){const interval=1000/fpsCap,elapsed=frameNow-lastFrame;if(elapsed<interval)return;lastFrame=frameNow-(elapsed%interval);}else lastFrame=frameNow;
 frameMeter.beforeRender();
 parkToneMapper.render(scene,camera);
 frameMeter.end(fpsCap,renderScheduler.stats);
 return true;
},loadFailed);
document.querySelector('#render-scheduling').addEventListener('change',e=>renderScheduler.setMode(e.target.value));
renderScheduler.start();
