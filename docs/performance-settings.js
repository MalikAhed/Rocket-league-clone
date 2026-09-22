export const PERFORMANCE_DEFAULTS=Object.freeze({mode:'uncapped',cap:0,scale:.6,showFPS:true});
export function normalizePerformance(value={}){
 value=value&&typeof value==='object'?value:{};
 return {mode:value.mode==='display'?'display':'uncapped',cap:Number.isFinite(Number(value.cap))?Math.max(0,Math.min(1000,Math.round(Number(value.cap)))):0,
 scale:[.4,.6,.8,.85,1].includes(Number(value.scale))?Number(value.scale):.6,showFPS:value.showFPS!==false};
}
let saved={};try{saved=JSON.parse(localStorage.getItem('beckwith.performance.v1')||'{}')??{};}catch{}
export const performanceSettings=normalizePerformance(saved);
export function setupPerformanceSettings(scheduler,canvas){
 const $=s=>document.querySelector(s),panel=document.createElement('dialog');
 panel.id='performance-settings';panel.setAttribute('aria-label','Graphics and performance');
 panel.innerHTML=`<h2>Graphics & performance</h2><p>Changes apply immediately and save on this device.</p>
 <div class="performance-presets" role="group" aria-label="Performance presets"><button data-profile="fast">Maximum FPS</button><button data-profile="balanced">Balanced</button><button data-profile="detail">Best detail</button></div>
 <div id="graphics-options"></div><label>Show FPS <input id="show-fps" type="checkbox"></label>
 <p>Uncapped removes the game's refresh-rate limit. Your browser, display and GPU still determine actual performance. Display-paced follows your monitor's refresh rate. Set FPS cap to 0 for no application limit.</p>
 <div id="performance-readout" aria-live="off"></div><div class="actions"><button id="performance-reset">Reset performance settings</button><button id="performance-close">Done</button></div>`;
 document.body.append(panel);
 const options=$('#graphics-options'),quality=$('#quality-control');
 options.append(...quality.children);quality.remove();
 for(const id of ['render-scheduling','fps-cap'])options.append($('#'+id).closest('label'));
 $('#performance-readout').append($('#performance-status'));
 const mode=$('#render-scheduling'),cap=$('#fps-cap'),scale=$('#render-scale'),show=$('#show-fps');
 mode.value=performanceSettings.mode;cap.value=performanceSettings.cap;show.checked=performanceSettings.showFPS;
 function save(){
  Object.assign(performanceSettings,normalizePerformance({mode:mode.value,cap:cap.value,scale:scale.value,showFPS:show.checked}));
  scheduler.setMode(performanceSettings.mode);$('#fps-overlay').hidden=!performanceSettings.showFPS;
  canvas.dataset.performanceSettings=JSON.stringify(performanceSettings);
  try{localStorage.setItem('beckwith.performance.v1',JSON.stringify(performanceSettings));}catch{}
 }
 for(const el of [mode,cap,scale,show])el.addEventListener('change',save);
 cap.addEventListener('input',save);
 function choose(el,value){el.value=el.options?[...el.options].find(o=>o.value===String(value)||typeof value==='number'&&Number(o.value)===value)?.value??String(value):String(value);el.dispatchEvent(new Event('change',{bubbles:true}));}
 function apply(qualityName,renderScale,renderMode,fps){
  try{localStorage.setItem('beckwith.quality',qualityName);}catch{}
  choose($('#quality-preset'),qualityName);choose(scale,renderScale);choose(mode,renderMode);choose(cap,fps);save();
 }
 panel.addEventListener('click',e=>{
  const profile=e.target.dataset.profile;
  if(profile==='fast')apply('low',.4,'uncapped',0);
  if(profile==='balanced')apply('balanced',.6,'display',0);
  if(profile==='detail')apply('realistic',1,'display',0);
 });
 $('#performance-open').onclick=()=>panel.showModal();$('#performance-close').onclick=()=>panel.close();
 $('#performance-reset').onclick=()=>{show.checked=true;apply('low',.6,'uncapped',0);};
 // Keep driving and menu shortcuts from consuming input while editing settings.
 for(const type of ['keydown','pointerdown'])panel.addEventListener(type,e=>e.stopPropagation());
 save();
}
