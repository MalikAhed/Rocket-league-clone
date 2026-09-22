import * as THREE from 'three';
import {withParkFog} from './park-height-fog.js';
const shared=new Map();

// The twelve advertisements already use one atlas, but each tile was a
// separate material/draw. Bake only the UV transform to share the atlas draw.
export function batchAdvertMaterial(source,geometry){
 const atlas=source.userData.adAtlasMap;
 if(!atlas||!source.isMeshBasicMaterial||source.transparent)return source;
 source.map.updateMatrix();const e=source.map.matrix.elements,uv=geometry.attributes.uv;
 for(let i=0;i<uv.count;i++){const x=uv.getX(i),y=uv.getY(i);uv.setXY(i,e[0]*x+e[3]*y+e[6],e[1]*x+e[4]*y+e[7]);}
 const key=[atlas.uuid,source.color.getHex(),source.side,source.depthWrite,source.visible,source.toneMapped].join('|');
 if(!shared.has(key)){
  const m=new THREE.MeshBasicMaterial({map:atlas,color:source.color,side:source.side,depthWrite:source.depthWrite,visible:source.visible,toneMapped:source.toneMapped});
  m.name='Shared original advertisement atlas';m.userData.sourceMaterial=source.userData.sourceMaterial;withParkFog(m);shared.set(key,m);
 }
 return shared.get(key);
}
