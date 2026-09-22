import {TierTextureLoader} from './texture-tiers.js';
import * as THREE from 'three';
import {geometryLoader} from './geometry-loader.js';
import {createRecoveredVehicle,prepareVehicleGeometry,createOriginalLenses} from './recovered-vehicles.js';
export async function loadOriginalFennec(){
 const base='./assets/original/fennec/',loader=new TierTextureLoader();
 const [asset,body,chassis]=await Promise.all([geometryLoader().loadAsync(base+'SkeletalMesh3/Body_Grain_SK.gltf'),createRecoveredVehicle('Body'),createRecoveredVehicle('Chassis')]);
 asset.scene.updateMatrixWorld(true);const root=new THREE.Group();root.name='Body_Grain_SK — original Rocket League Fennec';
 asset.scene.traverse(n=>{if(!n.isMesh)return;const g=n.geometry.clone().applyMatrix4(n.matrixWorld);g.scale(100,100,100);prepareVehicleGeometry(g);const m=new THREE.Mesh(g,/MIC_Body/.test(n.material.name)?body:chassis);m.name=n.material.name;root.add(m);});
 const [lensAsset,lensColors,lensMaterial]=await Promise.all([geometryLoader().loadAsync(base+'StaticMesh3/Body_Grain_Lenses_SM.gltf'),fetch(base+'lens-colors.json').then(r=>r.json()),createOriginalLenses()]);
 lensAsset.scene.updateMatrixWorld(true);let lensPart=0;
 lensAsset.scene.traverse(n=>{if(!n.isMesh)return;const g=n.geometry.clone().applyMatrix4(n.matrixWorld).toNonIndexed();g.scale(100,100,100);prepareVehicleGeometry(g);g.setAttribute('tangent',g.attributes.sourceVehicleTangent);const colors=lensColors.parts[lensPart++].sourceColor;if(colors.length!==g.attributes.position.count*4)throw Error('Original lens color mapping mismatch');g.setAttribute('sourceColor',new THREE.Float32BufferAttribute(colors,4));const lens=new THREE.Mesh(g,lensMaterial);lens.name='Original Fennec lens covers';root.add(lens);});
 const wheelAsset=await geometryLoader().loadAsync('./assets/original/wheel/WHEEL_Star_SM.gltf');
 const wheelD=await loader.loadAsync('./assets/original/wheel/OEM_D.png');wheelD.flipY=false;wheelD.colorSpace=THREE.SRGBColorSpace;
 const wheelN=await loader.loadAsync('./assets/original/wheel/OEM_N.png');wheelN.flipY=false;
 const wheelMat=new THREE.MeshPhongMaterial({map:wheelD,normalMap:wheelN,normalScale:new THREE.Vector2(1,-1),shininess:50,specular:0x64717a});wheelMat.name='Original OEM wheel textures';
 const wheels=[];wheelAsset.scene.updateMatrixWorld(true);
 for(const jointName of ['FL_WheelTranslation_jnt','FR_WheelTranslation_jnt','BL_WheelTranslation_jnt','BR_WheelTranslation_jnt']){
  const joint=asset.scene.getObjectByName(jointName);const wheel=new THREE.Group();joint.getWorldPosition(wheel.position);wheel.position.multiplyScalar(100);wheel.position.z-=Math.sign(wheel.position.z)*.5;wheel.name='Original OEM wheel';
  const radius=jointName.startsWith('F')?12.75:13.75;
  wheelAsset.scene.traverse(n=>{if(n.isMesh){const g=n.geometry.clone().applyMatrix4(n.matrixWorld);g.scale(radius/.16313,radius/.16313,13/.1452878);const m=new THREE.Mesh(g,wheelMat);if(wheel.position.z<0)m.rotation.y=Math.PI;wheel.add(m);}});root.add(wheel);wheels.push(wheel);
 }
 root.userData.wheels=wheels;root.userData.chassisMaterial=chassis;root.userData.bodyMaterial=body;
 return root;
}
