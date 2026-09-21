import * as THREE from 'three';
// The current WASM adapter fills GROUND_NORMAL with (0,0,1), even on walls.
// Recover the contacted surface from wheel rays and the actual collision mesh.
export function createCameraContact(boundary,config){
 const origin=new THREE.Vector3(),direction=new THREE.Vector3(),hit=new THREE.Vector3(),sum=new THREE.Vector3(),up=new THREE.Vector3();
 return function contactNormal(car,state,target){
  up.set(0,1,0).applyQuaternion(car.quaternion);direction.copy(up).negate();sum.set(0,0,0);let hits=0;
  for(let i=0;i<config.wheels.length;i++){
   if(state[50+i*3]!==1)continue;const wheel=config.wheels[i],p=wheel.connectionXYZ;
   origin.set(p[0],p[2],p[1]).applyQuaternion(car.quaternion).add(car.position).multiplyScalar(.01).addScaledVector(up,.08);
   const distance=(wheel.suspensionRestLength+wheel.radius)*.01+.18;
   if(boundary.surfaceNormal(origin,direction,distance,hit)){sum.add(hit);hits++;}
  }
  // Contact flags can change before the wheel rays settle at a seam. Use the
  // chassis up direction for that frame, never a hardcoded floor normal.
  return target.copy(hits&&sum.lengthSq()>.01?sum:up).normalize();
 };
}
