import * as THREE from 'three';
import {textureTierManifest} from './texture-tier-manifest.js';
import {effectTextureTiers} from './effect-texture-tiers.js';
Object.assign(textureTierManifest,effectTextureTiers);

const valid=q=>['realistic','balanced','low'].includes(q);
let quality='low';
try{const requested=new URLSearchParams(location.search).get('quality');const saved=localStorage.getItem('beckwith.quality');quality=valid(requested)?requested:valid(saved)?saved:'low';}catch{}
const managed=new Map();let revision=0;
function key(url){const value=String(url);return value.startsWith('./')?value:'./'+value.replace(/^\//,'');}
export function tierTextureURL(url,tier=quality){return textureTierManifest[key(url)]?.[tier]?.url??url;}

export class TierTextureLoader extends THREE.TextureLoader{
 load(url,onLoad,onProgress,onError){
  const resolved=tierTextureURL(url),entry={url,loaded:resolved,texture:null};
  const texture=super.load(resolved,t=>{entry.loaded=resolved;onLoad?.(t);},onProgress,onError);
  entry.texture=texture;managed.set(texture,entry);return texture;
 }
}

function publish(canvas,state,error=''){
 let originalPixels=0,currentPixels=0,resized=0;
 for(const {url,texture}of managed.values()){
  const image=texture.image;if(!image?.width)continue;
  const source=textureTierManifest[key(url)];
  originalPixels+=(source?.width??image.width)*(source?.height??image.height);
  currentPixels+=image.width*image.height;
  if(source&&image.width<source.width)resized++;
 }
 canvas.dataset.textureQuality=JSON.stringify({quality,state,error,textures:managed.size,resized,originalPixels,currentPixels,baseRGBABytes:currentPixels*4,originalRGBABytes:originalPixels*4});
}

export async function setTextureQuality(tier,canvas){
 quality=valid(tier)?tier:'realistic';const version=++revision;
 const pending=[...managed.values()].filter(e=>tierTextureURL(e.url)!==e.loaded);
 publish(canvas,'loading');
 try{
  // Limit decode concurrency on memory-constrained devices. Original images
  // are not retained by this manager: Realistic reloads them when requested.
  await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{
   while(pending.length&&version===revision){
    const entry=pending.shift(),url=tierTextureURL(entry.url);
    const image=await new THREE.ImageLoader().loadAsync(url);
    if(version!==revision)return;
    // Release the old GPU allocation even if this normal map is unused in
    // the new preset. Used textures are re-uploaded at the smaller size.
    entry.texture.dispose();entry.texture.image=image;entry.texture.needsUpdate=true;entry.loaded=url;
   }
  }));
  if(version!==revision)return false;
  publish(canvas,'ready');return true;
 }catch(error){if(version!==revision)return false;publish(canvas,'error',error.message);throw error;}
}

export function managedTextureResidency(renderer){
 let textures=0,bytes=0;const allocations=new Set();
 for(const {texture}of managed.values()){
  const properties=renderer.properties.get(texture),allocation=properties.__webglTexture;
  if(!allocation||properties.__version!==texture.version||allocations.has(allocation))continue;
  allocations.add(allocation);textures++;
  let {width,height}=texture.image;bytes+=width*height*4;
  if(texture.generateMipmaps&&texture.minFilter!==THREE.LinearFilter&&texture.minFilter!==THREE.NearestFilter){
   while(width>1||height>1){width=Math.max(1,width>>1);height=Math.max(1,height>>1);bytes+=width*height*4;}
  }
 }
 return {textures,estimatedRGBABytesIncludingMips:bytes};
}
