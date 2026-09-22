import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {tierTextureURL} from './texture-tiers.js';

export function geometryLoader(){
 const loader=new GLTFLoader();
 // These imports only supply geometry/joints. Every material is replaced by
 // the recovered game shader, so reduced-tier startup need not fetch/decode
 // the glTF fallback images that will never reach the screen.
 {
  loader.register(parser=>({name:'ParkGeometryOnly',loadMaterial(index){
   const material=new THREE.MeshBasicMaterial();material.name=parser.json.materials[index]?.name??'';
   return Promise.resolve(material);
  }}));
 }
 return loader;
}
