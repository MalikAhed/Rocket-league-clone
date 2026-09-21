import {managedTextureResidency} from './texture-tiers.js';
// Nonblocking GPU samples. Never wait for GPU completion in the render loop.
export function createFrameMeter(renderer,canvas){
 const hud=document.createElement('div');hud.id='fps-overlay';hud.textContent='— FPS';
 canvas.parentElement.append(hud);
 const details=document.querySelector('#performance-status');
 const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 const pending=[];let query=null,tick=0,start=performance.now(),frames=0,cpu=0,gpu=[],intervals=[],last=0,frameStart=0,lastCompleted=0;
 document.addEventListener('visibilitychange',()=>{lastCompleted=null;start=performance.now();frames=0;cpu=0;intervals=[];last=0;});
 return {
  begin(){frameStart=performance.now();},
  beforeRender(){
   if(!ext||++tick%20!==0)return;
   const disjoint=ext&&gl.getParameter(ext.GPU_DISJOINT_EXT);
   if(disjoint){for(const q of pending)gl.deleteQuery(q);pending.length=0;gpu=[];}
   while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
    const q=pending.shift();if(!disjoint)gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
   }
   if(pending.length<4&&!disjoint){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
  },
  end(cap,scheduler){
   if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(query);query=null;}
   const now=performance.now();cpu+=now-frameStart;frames++;if(last)intervals.push(now-last);last=now;
   if(now-start<1000)return;
   const fps=frames*1000/(now-start),cpuMs=cpu/frames,gpuMs=gpu.length?gpu.reduce((a,b)=>a+b,0)/gpu.length:null;
   intervals.sort((a,b)=>a-b);const p95=intervals[Math.floor((intervals.length-1)*.95)]??0;
   const gpuCompletedFps=lastCompleted===null?null:(scheduler.completed-lastCompleted)*1000/(now-start);lastCompleted=scheduler.completed;
   const quality=canvas.dataset.quality||'realistic',scale=renderer.getPixelRatio();
   hud.textContent=`${Math.round(fps)} render FPS\n${gpuCompletedFps===null?'--':Math.round(gpuCompletedFps)} GPU FPS\n${quality[0].toUpperCase()+quality.slice(1)} · ${Math.round(scale*100)}% · ${canvas.width}×${canvas.height}`;
   hud.title=`${cap?cap+' FPS cap':scheduler.mode==='uncapped'?'Uncapped render scheduling':'Display-paced rendering'} · GPU FPS measures completed frames, not monitor refreshes · CPU ${cpuMs.toFixed(2)} ms · GPU ${gpuMs===null?'unavailable':gpuMs.toFixed(2)+' ms'} · p95 frame ${p95.toFixed(2)} ms`;
   const result={fps,cpuMs,gpuMs,p95FrameMs:p95,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,scale,quality,bufferWidth:canvas.width,bufferHeight:canvas.height,viewportWidth:canvas.clientWidth,viewportHeight:canvas.clientHeight,cap,gpuCompletedFps,scheduling:scheduler.mode,gpuBacklog:scheduler.backlog};
   canvas.dataset.performance=JSON.stringify(result);
   canvas.dataset.textureResidency=JSON.stringify(managedTextureResidency(renderer));
   details.textContent=`${hud.textContent} · CPU ${cpuMs.toFixed(2)} ms · GPU ${gpuMs===null?'n/a':gpuMs.toFixed(2)+' ms'} · ${result.drawCalls} draws · ${Math.round(result.triangles/1000)}k triangles · ${Math.round(result.scale*100)}% scale`;
   frames=0;cpu=0;gpu=[];intervals=[];start=now;
  }
 };
}
