import {controlSettings as config,keyboardBindings as keys} from './player-settings.js';
const sessions=new WeakMap();
export function appendControlSettings(rows,panel,status,save){
 sessions.get(panel)?.abort();const session=new AbortController();sessions.set(panel,session);
 for(const [key,label,min,max,step]of [['dodgeDeadzone','Dodge deadzone',.01,1,.01],['steeringSensitivity','Steering sensitivity',1,10,.01],['aerialSensitivity','Aerial sensitivity',1,10,.01],['lookDeadzone','Camera stick deadzone',0,.95,.01],['keyboardBlendTime','Keyboard input acceleration (seconds)',0,.25,.01]]){
  const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.value=config[key];input.id='control-'+key;
  input.onchange=()=>{if(!Number.isFinite(input.valueAsNumber))return;config[key]=Math.max(min,Math.min(max,input.valueAsNumber));input.value=config[key];save();};row.append(input);rows.append(row);
 }
 const heading=document.createElement('h3');heading.textContent='Keyboard & mouse';rows.append(heading);
 const labels={throttle:'Accelerate',reverse:'Reverse / brake',steerLeft:'Steer left',steerRight:'Steer right',pitchUp:'Pitch up',pitchDown:'Pitch down',yawLeft:'Yaw left',yawRight:'Yaw right',jump:'Jump',boost:'Boost',handbrake:'Powerslide',airRoll:'Air roll modifier',airRollLeft:'Air roll left',airRollRight:'Air roll right',camera:'Ball camera',rearView:'Rear view',reset:'Reset training',bringBall:'Dribble setup',takePossession:'Bring ball',launchBall:'Launch ball',passBall:'Pass ball',lookLeft:'Look left',lookRight:'Look right',lookUp:'Look up',lookDown:'Look down'};
 let capture;
 for(const [key,label]of Object.entries(labels)){
  const row=document.createElement('div');row.className='binding-row';const name=document.createElement('span');name.textContent=label;
  const button=document.createElement('button');button.textContent=keys[key]||'Unassigned';button.setAttribute('aria-label',label+' keyboard binding');button.onclick=()=>{capture={key,button};status.textContent=`Press a key or mouse button for ${label}. Escape cancels.`;};
  const clear=document.createElement('button');clear.textContent='Clear';clear.setAttribute('aria-label','Clear '+label+' keyboard binding');clear.onclick=()=>{keys[key]='';button.textContent='Unassigned';save();};row.append(name,button,clear);rows.append(row);
 }
 function finish(code){keys[capture.key]=code;capture.button.textContent=code;capture=null;save();}
 panel.addEventListener('keydown',e=>{if(!capture)return;e.preventDefault();e.stopPropagation();if(e.code==='Escape'){capture=null;status.textContent='Binding cancelled.';}else finish(e.code);},{capture:true,signal:session.signal});
 panel.addEventListener('pointerdown',e=>{if(!capture)return;e.preventDefault();e.stopPropagation();finish('Mouse'+e.button);},{capture:true,signal:session.signal});
 panel.addEventListener('contextmenu',e=>e.preventDefault(),{signal:session.signal});
}
