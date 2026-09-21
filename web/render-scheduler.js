// Render independently of presentation. Fence completion bounds queued GPU work;
// a completed fence is not proof that the compositor displayed the frame.
export function createRenderScheduler(renderer,render,onError){
 const gl=renderer.getContext(),pending=[],channel=new MessageChannel();
 const stats={mode:'display',submitted:0,completed:0,backlog:0};
 let mode='display',scheduled=false,timer=0,raf=0,stopped=false;
 function poll(){
  while(pending.length){
   const wait=gl.clientWaitSync(pending[0],0,0);
   if(wait===gl.TIMEOUT_EXPIRED)break;
   if(wait===gl.WAIT_FAILED)throw new Error('GPU frame completion query failed');
   gl.deleteSync(pending.shift());stats.completed++;
  }
  stats.backlog=pending.length;
 }
 function schedule(busy=false){
  if(stopped||document.hidden||scheduled)return;
  scheduled=true;
  if(mode==='display')raf=requestAnimationFrame(tick);
  else if(busy)timer=setTimeout(tick,1);
  else channel.port2.postMessage(0);
 }
 function tick(){
  scheduled=false;
  if(stopped||document.hidden)return;
  try{
   poll();
   // At most two submitted frames await completion. Avoid accumulating old input.
   if(pending.length>=2){schedule(true);return;}
   const rendered=render();
   if(rendered){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw new Error('Unable to track GPU frame completion');pending.push(sync);gl.flush();stats.submitted++;stats.backlog=pending.length;}
   schedule(!rendered);
  }catch(error){stopped=true;onError(error);}
 }
 channel.port1.onmessage=tick;
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 return {stats,start(){schedule();},setMode(value){mode=value==='display'?'display':'uncapped';stats.mode=mode;},
  dispose(){stopped=true;clearTimeout(timer);cancelAnimationFrame(raf);channel.port1.close();channel.port2.close();pending.forEach(s=>gl.deleteSync(s));}
 };
}
