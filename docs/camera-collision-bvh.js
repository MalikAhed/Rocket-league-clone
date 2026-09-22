import * as THREE from 'three';
// Static arena triangles indexed once. Camera queries visit nearby bounds instead
// of testing every arena triangle five times per rendered frame.
export function createCollisionIndex(meshes){
 const triangles=[],point=new THREE.Vector3();
 for(const mesh of meshes){const g=mesh.geometry,p=g.attributes.position,index=g.index;mesh.updateMatrixWorld(true);
  const count=index?.count??p.count;
  for(let i=0;i<count;i+=3){const t=[];for(let j=0;j<3;j++){point.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);t.push(point.x,point.y,point.z);}triangles.push(t);}
 }
 const bounds=triangles.map(t=>[Math.min(t[0],t[3],t[6]),Math.min(t[1],t[4],t[7]),Math.min(t[2],t[5],t[8]),Math.max(t[0],t[3],t[6]),Math.max(t[1],t[4],t[7]),Math.max(t[2],t[5],t[8])]);
 function build(ids){
  const box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const id of ids)for(let a=0;a<3;a++){box[a]=Math.min(box[a],bounds[id][a]);box[a+3]=Math.max(box[a+3],bounds[id][a+3]);}
  if(ids.length<=12)return {box,ids};let axis=0;for(let a=1;a<3;a++)if(box[a+3]-box[a]>box[axis+3]-box[axis])axis=a;
  ids.sort((a,b)=>(bounds[a][axis]+bounds[a][axis+3])-(bounds[b][axis]+bounds[b][axis+3]));const mid=ids.length>>1;
  return {box,left:build(ids.slice(0,mid)),right:build(ids.slice(mid))};
 }
 const root=build(triangles.map((_,i)=>i)),stack=[];
 return {nearest(origin,direction,far,normal=null){
  const o=[origin.x,origin.y,origin.z],d=[direction.x,direction.y,direction.z];let best=far,found=false;stack.length=0;stack.push(root);
  while(stack.length){const n=stack.pop();let near=0,end=best,hit=true;
   for(let a=0;a<3;a++){if(Math.abs(d[a])<1e-10){if(o[a]<n.box[a]||o[a]>n.box[a+3]){hit=false;break;}}else{let x=(n.box[a]-o[a])/d[a],y=(n.box[a+3]-o[a])/d[a];if(x>y)[x,y]=[y,x];near=Math.max(near,x);end=Math.min(end,y);if(end<near){hit=false;break;}}}
   if(!hit)continue;if(!n.ids){stack.push(n.left,n.right);continue;}
   for(const id of n.ids){const t=triangles[id],ax=t[3]-t[0],ay=t[4]-t[1],az=t[5]-t[2],bx=t[6]-t[0],by=t[7]-t[1],bz=t[8]-t[2];
    const px=d[1]*bz-d[2]*by,py=d[2]*bx-d[0]*bz,pz=d[0]*by-d[1]*bx,det=ax*px+ay*py+az*pz;if(Math.abs(det)<1e-9)continue;
    const tx=o[0]-t[0],ty=o[1]-t[1],tz=o[2]-t[2],u=(tx*px+ty*py+tz*pz)/det;if(u<0||u>1)continue;
    const qx=ty*az-tz*ay,qy=tz*ax-tx*az,qz=tx*ay-ty*ax,v=(d[0]*qx+d[1]*qy+d[2]*qz)/det;if(v<0||u+v>1)continue;
    const distance=(bx*qx+by*qy+bz*qz)/det;if(distance>=.015&&distance<best){best=distance;found=true;if(normal)normal.set(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx).normalize();}
   }
  }
  return found?best:Infinity;
 }};
}
