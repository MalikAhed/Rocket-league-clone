// Opt-in local diagnostic. Fixed viewport dimensions make repeated comparisons
// comparable even when the Codex side panel is resized during a run.
export async function benchmarkPresets(controller,canvas){
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const results=[];canvas.dataset.presetBenchmark=JSON.stringify({state:'running'});
 for(const quality of ['realistic','balanced','low','realistic']){
  await controller.setQuality(quality,{save:false});
  await pause(2500);const samples=[];
  for(let i=0;i<5;i++){
   await pause(1100);
   samples.push({...JSON.parse(canvas.dataset.performance),width:canvas.clientWidth,height:canvas.clientHeight,visible:!document.hidden});
  }
  results.push({quality,geometry:JSON.parse(canvas.dataset.qualityStats),textures:JSON.parse(canvas.dataset.textureQuality||'{}'),residency:JSON.parse(canvas.dataset.textureResidency||'{}'),samples});
  canvas.dataset.presetBenchmark=JSON.stringify({state:'running',results});
 }
 const pass=results.every(r=>r.samples.every(s=>s.visible&&s.width===1280&&s.height===684&&s.scale===results[0].samples[0].scale))&&canvas.dataset.shaderErrors==='0';
 canvas.dataset.presetBenchmark=JSON.stringify({state:pass?'PASS':'INVALID',results});
}
