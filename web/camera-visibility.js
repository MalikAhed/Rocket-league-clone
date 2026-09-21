import * as THREE from 'three';
// Keep native HexGlass visible; hide camera-side banners, frames and trim. Other geometry does
// not receive this shader hook. No mesh visibility, shading or lighting changes
// while the chase camera is inside, or during reference/reflection renders.
const state={camera:null,active:false,plane:new THREE.Vector4()};
export function setCameraVisibility(camera,plane){state.camera=camera;state.active=Boolean(plane);if(plane)state.plane.copy(plane);}
export function attachCameraVisibility(root){
 const variants=new Map();
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.userData.cameraOccluder)return;
  const variant=source=>{
   if(variants.has(source))return variants.get(source);
   const m=source.clone();m.userData={...source.userData};
   // Recovered shaders update shared authored uniform objects in their render
   // callbacks. Keep those objects shared, but isolate the shader program so
   // unrelated meshes using the original material never acquire the cut.
   if(source.uniforms)m.uniforms={...source.uniforms};
   m.onBeforeCompile=source.onBeforeCompile;m.onBeforeRender=source.onBeforeRender;
   m.customProgramCacheKey=source.customProgramCacheKey.bind(source);
   variants.set(source,m);return m;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(variant):variant(mesh.material);
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(material.userData.cameraVisibility||material.userData.recoveredSurface==='hexglass')continue;
   material.userData.cameraVisibility=true;


   const enabled={value:0},plane={value:state.plane};
   const compile=material.onBeforeCompile,render=material.onBeforeRender,key=material.customProgramCacheKey();
   material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.chaseExteriorEnabled=enabled;shader.uniforms.chaseExteriorPlane=plane;
    shader.vertexShader='varying float chaseExteriorDistance;\nuniform float chaseExteriorEnabled;\nuniform vec4 chaseExteriorPlane;\n'+shader.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/, '$&\nchaseExteriorDistance=chaseExteriorEnabled>0.5?dot(modelMatrix*vec4(position,1.0),chaseExteriorPlane):-1.0;');
    // HexGlass keeps its original translucent material; opaque obstructions are cut.
    // The car and scenery never receive this hook.
    shader.fragmentShader='varying float chaseExteriorDistance;\n'+shader.fragmentShader.replace(/}\s*$/,'\nif(chaseExteriorDistance>0.0) discard;\n}');
   };
   material.onBeforeRender=function(renderer,scene,camera,...args){enabled.value=state.active&&camera===state.camera?1:0;render.call(this,renderer,scene,camera,...args);};
   material.customProgramCacheKey=()=>key+'|chase-exterior-v3';material.needsUpdate=true;
  }
 });
}


