// Explicit diagnostic URL only. Exercise real controls and real goal polling.
export function createEffectChecks(sim,reset){
 const panel=document.createElement('div');panel.style.cssText='position:absolute;bottom:48px;left:12px;z-index:10;background:#11231f;padding:8px;display:flex;gap:6px';
 const boost=document.createElement('input');boost.type='checkbox';boost.setAttribute('aria-label','Hold boost for effect check');
 const label=document.createElement('label');label.textContent='Hold boost ';label.append(boost);panel.append(label);
 const throttle=document.createElement('input');throttle.type='checkbox';throttle.setAttribute('aria-label','Hold throttle for effect check');const throttleLabel=document.createElement('label');throttleLabel.textContent='Throttle ';throttleLabel.append(throttle);panel.append(throttleLabel);
 let jumpTicks=0;
 const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;panel.append(b);};
 button('Jump effect',()=>{jumpTicks=8;});
 button('Score test goal',()=>{
  reset();const state=new Float32Array(64);state.set([0,5050,150,1,0,0,0,1,0,0,0,1,0,2000,0]);
  const carState=new Float32Array(64);carState.set([0,4300,17,1,0,0,0,1,0,0,0,1]);carState[18]=100;const cp=sim.module._malloc(carState.byteLength);try{sim.module.HEAPF32.set(carState,cp/4);sim.module._physics_setCarState(0,cp);}finally{sim.module._free(cp);}
  const ptr=sim.module._malloc(state.byteLength);try{sim.module.HEAPF32.set(state,ptr/4);sim.module._physics_setBallState(ptr);}finally{sim.module._free(ptr);}
 });
 button('Reset effects test',()=>{boost.checked=false;throttle.checked=false;reset();});
 document.querySelector('#viewport').append(panel);
 return {controls(input){if(throttle.checked)input.throttle=1;if(boost.checked){input.throttle=1;input.boost=true;}if(jumpTicks>0){input.jump=true;jumpTicks--;}return input;}};
}
