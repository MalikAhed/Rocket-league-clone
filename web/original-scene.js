import * as THREE from 'three';
import {sourceAssets} from './source-materials.js';
import {batchExterior} from './low-cost-look.js';
import {componentLighting} from './component-lighting.js';
import {attachCameraVisibility} from './camera-visibility.js';
export async function addOriginalSet(scene,file){
 const [assets,data,lighting]=await Promise.all([sourceAssets(),fetch(`./assets/original/${file}.json`).then(r=>r.json()),componentLighting()]);
 const geometries=new Map(),root=new THREE.Group();root.name=`Original Park_P ${file}`;
 root.matrixAutoUpdate=false;root.matrix.set(.01,0,0,0,0,0,.01,0,0,.01,0,0,0,0,0,1);
 function transform(t,r,s,u){const a=Math.PI*2/65536;return new THREE.Matrix4().compose(new THREE.Vector3(...t),new THREE.Quaternion().setFromEuler(new THREE.Euler(-r[2]*a,-r[0]*a,r[1]*a,'ZYX')),new THREE.Vector3(...s).multiplyScalar(u));}
 for(const i of data.instances){
  if(!geometries.has(i.mesh))geometries.set(i.mesh,assets.geometry(i.mesh));
  const m=new THREE.Mesh(geometries.get(i.mesh),data.materials[i.mesh].map((name,j)=>assets.mat(i.materials?.[j]??name,i.mesh,i)));m.name=i.mesh;
  const settings=i.sourceSettings??{};
  m.castShadow=settings.CastShadow!=='False'&&settings.bCastDynamicShadow!=='False';
  m.receiveShadow=settings.bAcceptsLights!=='False';m.renderOrder=Number(settings.TranslucencySortPriority??0);
  // Exported vertices use Unreal's handedness until the root swaps Y/Z.
  m.userData.sourceWinding=-1;m.userData.sourceComponent=i.name;
  lighting.attach(m,i);
  m.matrixAutoUpdate=false;m.matrix.multiplyMatrices(transform(i.parentTranslation,i.parentRotation,i.parentScale,i.parentScaleUniform),transform(i.translation,i.rotation,i.scale,i.scaleUniform));root.add(m);
 }
 const combined=batchExterior(root);combined.name=root.name;combined.userData.sourceInstanceCount=data.instances.length;attachCameraVisibility(combined);scene.add(combined);return data.instances.length;
}
