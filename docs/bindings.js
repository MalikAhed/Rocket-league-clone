import {controlSettings,DEFAULT_CONTROLS,savePlayerSettings,restoreImportedSettings} from './player-settings.js';
import {appendControlSettings} from './control-settings-ui.js';
export const DEFAULT_BINDINGS=DEFAULT_CONTROLS;
export const loadBindings=()=>({...controlSettings});
export const bindings=controlSettings;
export function setupBindings(){
 const panel=document.querySelector('#controls-panel'),rows=document.querySelector('#binding-rows'),status=document.querySelector('#binding-status');
 const labels={throttle:'Accelerate',reverse:'Reverse / brake',jump:'Jump',boost:'Boost',handbrake:'Powerslide',camera:'Ball camera',airRoll:'Air roll modifier',airRollLeft:'Air roll left',airRollRight:'Air roll right',rearView:'Rear view',reset:'Reset training',bringBall:'Dribble setup',takePossession:'Bring ball',launchBall:'Launch ball',passBall:'Pass ball'};
 const names=['A / Cross','B / Circle','X / Square','Y / Triangle','LB / L1','RB / R1','LT / L2','RT / R2','Back / Create','Start / Options','Left stick click','Right stick click','D-pad up','D-pad down','D-pad left','D-pad right','Home'];
 const save=()=>{status.textContent=savePlayerSettings()?'Saved on this browser.':'Applied for this session; browser storage unavailable.';};
 let capture=null,previous=[];
 function renderBindings(){rows.replaceChildren();for(const [key,label]of Object.entries(labels)){
  const row=document.createElement('div');row.className='binding-row';const name=document.createElement('label');name.textContent=label;name.htmlFor='bind-'+key;
  const select=document.createElement('select');select.id='bind-'+key;select.setAttribute('aria-label',label+' controller button');
  for(let i=-1;i<20;i++){const o=document.createElement('option');o.value=i;o.textContent=i===-1?'Unassigned':names[i]??`Button ${i}`;select.append(o);}select.value=bindings[key];select.onchange=()=>{bindings[key]=Number(select.value);save();};
  const button=document.createElement('button');button.type='button';button.textContent='Listen';button.setAttribute('aria-label','Record '+label);button.onclick=()=>{capture=key;previous=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected)?.buttons.map(b=>b.value>.5)??[];status.textContent=`Press a controller button for ${label}. Escape cancels.`;};row.append(name,select,button);rows.append(row);
 }
 for(const [key,label]of Object.entries({steerAxis:'Steering axis',pitchAxis:'Air pitch axis',lookXAxis:'Look horizontal axis',lookYAxis:'Look vertical axis'})){
  const row=document.createElement('label');row.textContent=label;const s=document.createElement('select');s.setAttribute('aria-label',label);for(let i=0;i<8;i++){const o=document.createElement('option');o.value=i;o.textContent=`Axis ${i}`;s.append(o);}s.value=bindings[key];s.onchange=()=>{bindings[key]=Number(s.value);save();};row.append(s);rows.append(row);
 }
 for(const [key,label]of [['invertPitch','Invert air pitch'],['invertLookY','Invert look vertical']]){const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.type='checkbox';input.checked=bindings[key];input.onchange=()=>{bindings[key]=input.checked;save();};row.append(input);rows.append(row);}
 }
 function render(){renderBindings();appendControlSettings(rows,panel,status,save);}
 render();
 document.querySelector('#controls-open').onclick=()=>{panel.showModal();status.textContent='Choose a button or use Listen. Driving pauses while this panel is open.';};
 document.querySelector('#controls-close').onclick=()=>{capture=null;panel.close();};
 panel.addEventListener('cancel',()=>capture=null);
 document.querySelector('#controls-defaults').onclick=()=>{restoreImportedSettings();render();document.querySelector('#controller-deadzone').value=bindings.deadzone;save();};
 const dz=document.querySelector('#controller-deadzone');dz.value=bindings.deadzone;dz.onchange=()=>{if(Number.isFinite(dz.valueAsNumber)){bindings.deadzone=Math.max(0,Math.min(.95,dz.valueAsNumber));save();}};
 panel.addEventListener('close',()=>window.dispatchEvent(new Event('player-controls-applied')));
 function tick(){if(panel.open){const p=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);if(p){const pressed=p.buttons.map(b=>b.value>.5);if(capture){const index=pressed.findIndex((v,i)=>v&&!previous[i]);if(index>=0){bindings[capture]=index;capture=null;render();save();}}previous=pressed;document.querySelector('#controller-live').textContent=`${p.mapping||'custom'} controller · axes ${p.axes.map(v=>v.toFixed(2)).join(' / ')} · buttons ${pressed.flatMap((v,i)=>v?[i]:[]).join(', ')||'none'}`;}else document.querySelector('#controller-live').textContent='No controller detected. Connect one and press a button.';}requestAnimationFrame(tick);}requestAnimationFrame(tick);
}
