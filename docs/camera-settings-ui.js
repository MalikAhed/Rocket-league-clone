import {cameraSettings,DEFAULT_CAMERA,savePlayerSettings} from './player-settings.js';
export function setupCameraSettings(onReset){
 const panel=document.querySelector('#camera-settings');
 function populate(){
  for(const [key,value]of Object.entries(cameraSettings)){const el=panel.querySelector(`[name="${key}"]`);if(!el)continue;if(el.type==='checkbox')el.checked=value;else el.value=value;}
 }
 populate();
 panel.addEventListener('change',e=>{const el=e.target,key=el.name;if(!(key in cameraSettings))return;
  if(el.type==='checkbox')cameraSettings[key]=el.checked;
  else if(Number.isFinite(el.valueAsNumber))cameraSettings[key]=Math.max(Number(el.min),Math.min(Number(el.max),el.valueAsNumber));
  populate();savePlayerSettings();onReset();
 });
 document.querySelector('#camera-open').onclick=()=>panel.showModal();
 document.querySelector('#camera-close').onclick=()=>panel.close();
 document.querySelector('#camera-defaults').onclick=()=>{Object.assign(cameraSettings,DEFAULT_CAMERA);populate();savePlayerSettings();onReset();};
 window.addEventListener('player-settings-imported',()=>{populate();onReset();});
 return cameraSettings;
}
