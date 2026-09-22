import {bindings} from './bindings.js';
export function deadzone(value,zone=.12){
 zone=Number.isFinite(zone)?Math.max(0,Math.min(.95,zone)):.12;
 if(!Number.isFinite(value)||Math.abs(value)<=zone)return 0;
 return Math.sign(value)*Math.min(1,(Math.abs(value)-zone)/(1-zone));
}
export function mapController(pad,config=bindings){
 const b=i=>Math.max(0,Math.min(1,pad?.buttons?.[i]?.value??0));
 const pressed=i=>b(i)>.5;
 const x=deadzone(pad?.axes?.[config.steerAxis],config.deadzone),y=deadzone(pad?.axes?.[config.pitchAxis],config.deadzone)*(config.invertPitch?-1:1);
 const left=pressed(config.airRollLeft),right=pressed(config.airRollRight);
 // Directional roll keeps yaw available, including shared modifier bindings.
 const directional=left||right,modifier=pressed(config.airRoll)&&!directional;
 const scaled=(value,sensitivity)=>Math.max(-1,Math.min(1,value*(Number.isFinite(sensitivity)?sensitivity:1)));
 return {throttle:b(config.throttle)-b(config.reverse),steer:scaled(x,config.steeringSensitivity),pitch:scaled(y,config.aerialSensitivity),yaw:modifier?0:scaled(x,config.aerialSensitivity),roll:directional?Number(right)-Number(left):modifier?scaled(x,config.aerialSensitivity):0,
  jump:pressed(config.jump),boost:pressed(config.boost),handbrake:pressed(config.handbrake),
  lookX:deadzone(pad?.axes?.[config.lookXAxis],config.lookDeadzone??config.deadzone),lookY:deadzone(pad?.axes?.[config.lookYAxis],config.lookDeadzone??config.deadzone)*(config.invertLookY?1:-1),
  camera:pressed(config.camera),rearView:pressed(config.rearView),reset:pressed(config.reset),bringBall:pressed(config.bringBall),takePossession:pressed(config.takePossession),launchBall:pressed(config.launchBall),passBall:pressed(config.passBall)};
}
export function createControllerReader(){
 let previous=mapController(null),lastIndex=null,resetStarted=0;
 return function read(){
  const pads=Array.from(navigator.getGamepads?.()??[]).filter(p=>p?.connected);
  const pad=!new URLSearchParams(location.search).has('keyboardOnly')&&document.hasFocus()&&!document.querySelector('#controls-panel')?.open&&!document.querySelector('#camera-settings')?.open?pads[0]:null;
  const input=mapController(pad);
  if(pad?.index!==lastIndex)previous=mapController(null);
  const now=performance.now();if(input.reset&&!previous.reset)resetStarted=now;
  const resetPressed=bindings.resetPressType==='tap'?Boolean(pad&&!input.reset&&previous.reset&&now-resetStarted<=(bindings.tapTime??.5)*1000):input.reset&&!previous.reset;
  const result={...input,cameraPressed:input.camera&&!previous.camera,resetPressed,bringBallPressed:input.bringBall&&!previous.bringBall,takePossessionPressed:input.takePossession&&!previous.takePossession,launchBallPressed:input.launchBall&&!previous.launchBall,passBallPressed:input.passBall&&!previous.passBall,
   connected:Boolean(pad),status:pad?'Controller connected':pads.length?'Focus viewer / standard mapping required':'Connect controller, then press a button'};
  previous=input;lastIndex=pad?.index??null;return result;
 };
}

