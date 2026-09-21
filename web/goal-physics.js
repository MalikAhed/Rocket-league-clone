// Stock Ball_Default -> ExplosionArchetype -> ExplosionComponent_X.
// Native property values, applied through the simulator's velocity-only bridge.
export async function createGoalPhysics(sim){
 const response=await fetch('./assets/original/goal-explosion/physics.json');
 if(!response.ok)throw Error('Goal physics source unavailable');
 const source=await response.json(),p=source.settings,hit=new Set(),origin=[0,0,0];let age=0,active=false,sign=1;
 if(typeof sim.module._physics_addCarVelocity!=='function')throw Error('Goal impulse bridge unavailable');
 sim.setGoalExplosionEnabled(false); // Disable the older application-specific blast.
 return {source,reset(){active=false;hit.clear();},trigger(goal,state){
  sign=Math.sign(goal)||1;origin[0]=state[4];origin[1]=state[5];origin[2]=state[6];age=0;active=true;hit.clear();
  // The scored ball is no longer a collidable gameplay object. The caller
  // retains its scoring position for the visible explosion and ball camera.
  const parked=new Float32Array(64);parked.set([0,0,-20000,1,0,0,0,1,0,0,0,1]);
  const ptr=sim.module._malloc(parked.byteLength);try{sim.module.HEAPF32.set(parked,ptr/4);sim.module._physics_setBallState(ptr);}finally{sim.module._free(ptr);}
 },update(dt){
  if(!active)return;age+=dt;const radius=Math.min(p.EndRadius,age*p.Speed),state=sim.state;
  for(let i=0;i<state[2];i++){
   if(hit.has(i))continue;const o=22+i*51;if(state[o+21])continue;
   const dx=state[o]-origin[0],dy=state[o+1]-origin[1],dz=state[o+2]-origin[2],distance=Math.hypot(dx,dy,dz);
   if(distance>radius)continue;
   hit.add(i);
   // Explosion local +X faces the field. The negative X/Z momentum offset
   // moves the impulse origin behind/below the ball, lifting grounded cars.
   const v=[dx-p.MomentumOffset[1],dy+sign*p.MomentumOffset[0],dz-p.MomentumOffset[2]],length=Math.hypot(...v);
   if(length<1e-6)continue;
   const strength=p.RBVelocityChange*Math.pow(Math.max(0,1-distance/p.EndRadius),p.Falloff);
   sim.module._physics_addCarVelocity(i,...v.map(x=>x/length*strength));
  }
  if(radius>=p.EndRadius)active=false;
 },get active(){return active;},get hitCount(){return hit.size;}};
}
