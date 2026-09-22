import * as THREE from 'three';
const direction=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3();
// Floor-only clearance. Walls and the ceiling must never confine the camera.
// Protect all four corners of the near plane, including wall-camera roll.
export function keepCameraAboveGround(camera,aim){
 direction.subVectors(aim,camera.position).normalize();right.crossVectors(direction,camera.up).normalize();up.crossVectors(right,direction).normalize();
 const halfHeight=camera.near*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),halfWidth=halfHeight*camera.aspect;
 const lowestOffset=direction.y*camera.near-Math.abs(up.y)*halfHeight-Math.abs(right.y)*halfWidth;
 const minimum=Math.max(.1,.025-lowestOffset),lift=Math.max(0,minimum-camera.position.y);
 camera.position.y+=lift;aim.y+=lift;
 return lift;
}
