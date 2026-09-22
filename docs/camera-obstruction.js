import * as THREE from 'three';
import {createCollisionIndex} from './camera-collision-bvh.js';

export function decodeCameraCollision(buffer){
 const view=new DataView(buffer),tris=view.getInt32(0,true),vertices=view.getInt32(4,true),vertexStart=8+tris*12;
 if(tris<=0||vertices<=0||vertexStart+vertices*12!==buffer.byteLength)throw Error('Invalid camera collision mesh');
 const indices=new Uint32Array(tris*3),positions=new Float32Array(vertices*3);
 for(let i=0;i<indices.length;i++){indices[i]=view.getUint32(8+i*4,true);if(indices[i]>=vertices)throw Error('Invalid camera collision index');}
 // CMF stores Bullet meters at 50 Unreal units per unit; scene meters are 100 uu.
 for(let i=0;i<vertices;i++){positions[i*3]=view.getFloat32(vertexStart+i*12,true)*.5;positions[i*3+1]=view.getFloat32(vertexStart+i*12+8,true)*.5;positions[i*3+2]=view.getFloat32(vertexStart+i*12+4,true)*.5;}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function createCameraBoundary(colliders){
 const index=createCollisionIndex(colliders),direction=new THREE.Vector3(),normal=new THREE.Vector3(),point=new THREE.Vector3(),plane=new THREE.Vector4();
 function surfaceNormal(origin,rayDirection,far,target){
  let distance=index.nearest(origin,rayDirection,far,target);
  for(const [axis,sign,limit]of [['x',1,40.96],['x',-1,40.96],['y',1,20.48],['y',-1,0]]){
   const velocity=rayDirection[axis]*sign;if(velocity<=1e-7)continue;const t=(limit-origin[axis]*sign)/velocity;
   if(t>=0&&t<distance&&t<far){distance=t;target.set(0,0,0);target[axis]=-sign;}
  }
  if(!Number.isFinite(distance))return false;if(target.dot(rayDirection)>0)target.negate();return true;
 }
 return {surfaceNormal,exteriorPlane(anchor,cameraPosition){
  direction.subVectors(cameraPosition,anchor);const length=direction.length();if(length<.001)return null;direction.multiplyScalar(1/length);
  let distance=index.nearest(anchor,direction,length,normal);
  // RocketSim adds these planes procedurally; end walls, corners and goal
  // openings come from the actual triangle meshes. The floor is excluded.
  for(const [axis,sign,limit]of [['x',1,40.96],['x',-1,40.96],['y',1,20.48]]){
   const velocity=direction[axis]*sign;if(velocity<=1e-7)continue;
   const t=(limit-anchor[axis]*sign)/velocity;
   if(t>=0&&t<distance&&t<length){distance=t;normal.set(0,0,0);normal[axis]=sign;}
  }
  if(!Number.isFinite(distance))return null;
  if(normal.dot(direction)<0)normal.negate();
  // A floor-facing collision is a ground-clearance issue, never a reason
  // to reveal the underside of the field.
  if(normal.y<-.98)return null;
  // The floor-to-wall curve has a downward outward normal. Its tangent
  // plane would leave high banners visible above the cut. Extend that
  // boundary vertically; the separate pitch material remains opaque.
  if(normal.y<0){normal.y=0;normal.normalize();}
  point.copy(anchor).addScaledVector(direction,distance);
  // Include the thin fascia on the inside of the collision surface. Keep
  // the cut on the far side of the car anchor even at wheel contact.
  const thickness=Math.min(.3,Math.max(0,normal.dot(point)-normal.dot(anchor)-.04));
  return plane.set(normal.x,normal.y,normal.z,-normal.dot(point)+thickness);
 }};
}
export async function loadCameraBoundary(){
 const names=await (await fetch('./assets/arena/collision/manifest.json')).json();
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const meshes=await Promise.all(names.map(async name=>{const r=await fetch('./assets/arena/collision/'+name);if(!r.ok)throw Error('Camera collision unavailable');return new THREE.Mesh(decodeCameraCollision(await r.arrayBuffer()),material);}));
 for(const mesh of meshes)mesh.updateMatrixWorld(true);
 const boundary=createCameraBoundary(meshes);for(const mesh of meshes)mesh.geometry.dispose();material.dispose();return boundary;
}
