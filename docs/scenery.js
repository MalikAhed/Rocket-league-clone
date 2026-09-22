import {addOriginalSet} from './original-scene.js';
export async function addScenery(scene,camera){camera.far=40000;camera.updateProjectionMatrix();const counts=await Promise.all([addOriginalSet(scene,'scenery'),addOriginalSet(scene,'atmosphere')]);return counts.reduce((a,b)=>a+b,0);}
