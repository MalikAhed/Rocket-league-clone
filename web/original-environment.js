import {TierTextureLoader} from './texture-tiers.js';
import * as THREE from 'three';
import {parkSource, fcolorLinearRGB, sourceMaterial} from './park-render-data.js';
import {skyShader_park,skyShader_partlycloudy} from './recovered-sky-shaders.js';

// Evaluate the recovered cooked uniform-expression trees, retaining exact
// authored time panners and parameter defaults rather than separate tuning.
export function skyExpression(node,time,parameters){
 if(node.type.endsWith('VectorParameter'))return parameters[node.parameter]??node.default;
 if(node.type.endsWith('Time'))return Array(4).fill(Math.fround(time));
 if(node.type.endsWith('Constant'))return node.valueType===15?Array(4).fill(node.value[0]):node.value;
 if(node.type.endsWith('Periodic'))return skyExpression(node.input,time,parameters).map(v=>Math.fround(v-Math.floor(v)));
 if(node.type.endsWith('FoldedMath')){
  const a=skyExpression(node.a,time,parameters),b=skyExpression(node.b,time,parameters);
  if(node.operation!==2)throw new Error(`Unknown recovered sky operation ${node.operation}`);
  return a.map((v,i)=>Math.fround(v*b[i]));
 }
 if(node.type.endsWith('AppendVector'))return [...skyExpression(node.a,time,parameters).slice(0,node.componentsA),...skyExpression(node.b,time,parameters)].slice(0,4);
 throw new Error(`Unknown recovered sky expression ${node.type}`);
}

export async function addOriginalDaylight(scene, renderer) {
  const rgb = bytes => new THREE.Color().setRGB(...fcolorLinearRGB(bytes));
  const skySource = parkSource.skyLight.props;
  // Preserve independently scaled upper/lower source irradiance.
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  hemisphere.color.copy(rgb(skySource.LightColor)).multiplyScalar(skySource.Brightness);
  hemisphere.groundColor.copy(rgb(skySource.LowerColor)).multiplyScalar(skySource.LowerBrightness);
  hemisphere.name = 'Park source upper/lower skylight';
  scene.add(hemisphere);
  const source = parkSource.directionalLights[0];
  const sun = new THREE.DirectionalLight(rgb(source.properties.LightColor), source.properties.Brightness ?? 1);
  sun.position.fromArray(source.directionToLightWebGL).multiplyScalar(180);
  sun.name = 'Park source directional-light transform';
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left:-100,right:100,top:100,bottom:-100,near:1,far:400});
  sun.shadow.normalBias = .04;
  sun.shadow.bias = -.0001;
  scene.add(sun);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  scene.fog = null; // Height fog is integrated before output color conversion.

  const read=async path=>{const response=await fetch(path);if(!response.ok)throw new Error(`Source sky: HTTP ${response.status}`);return response.json();};
  const [geometryData,bindings,clouds]=await Promise.all([
    read('./assets/original/source-sky-geometry.json'),read('./assets/original/source-sky-bindings.json'),
    new TierTextureLoader().loadAsync('./assets/original/FX_Textures__Noise__Noise_Smoke_03_Pack.png'),
  ]);
  clouds.wrapS=clouds.wrapT=THREE.RepeatWrapping;
  clouds.flipY=false; // Exact native DirectX UVs; exported PNG rows stay unflipped.
  clouds.colorSpace=THREE.SRGBColorSpace; // Native Texture SRGB=True, no instance override.
  const startTime=performance.now();
  for(const sourceSky of geometryData.meshes){
    const partly=sourceSky.material.startsWith('Sky_PartlyCloudy');
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(sourceSky.position,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(sourceSky.uv,2));
    geometry.setAttribute('sourceAlpha',new THREE.Float32BufferAttribute(sourceSky.sourceAlpha,1));
    const vectors=Array.from({length:84},()=>new THREE.Vector4());
    const material=new THREE.ShaderMaterial({side:THREE.FrontSide,depthWrite:false,toneMapped:false,
      uniforms:{sky_t0:{value:clouds},skyCB:{value:vectors}},
      // Retain original world placement/UV perspective, only move depth onto
      // the far plane so the source18-83km meshes survive the viewer far clip.
      vertexShader:`attribute float sourceAlpha;varying vec2 skyUV;varying float skyAlpha;
        void main(){skyUV=uv;skyAlpha=sourceAlpha;vec4 projected=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=projected.xyww;}`,
      fragmentShader:`varying vec2 skyUV;varying float skyAlpha;${partly?skyShader_partlycloudy:skyShader_park}
        void main(){gl_FragColor=vec4(recoveredSkyColour(skyUV,skyAlpha),1.);
          #include <colorspace_fragment>
        }`,
    });
    const sky=new THREE.Mesh(geometry,material);
    const sourceBindings=bindings.find(b=>b.material===sourceSky.material).vectors;
    const parameters=sourceMaterial(sourceSky.material).vector;
    const update=()=>{const time=(performance.now()-startTime)/1000;for(const binding of sourceBindings)vectors[binding.baseIndex/16].fromArray(skyExpression(binding.expression,time,parameters));};
    update();sky.onBeforeRender=update;
    // The partly-cloudy upper dome is the nearest source layer on all sampled
    // visible sky rays. Draw it after the outer/lower Park layer if they overlap.
    // Shade sky after opaque geometry: its far-plane depth then rejects the
    // pixels already covered by the field/stadium. Preserve the two sky layers'
    // original relative order; transparent scene surfaces still render after.
    sky.renderOrder=partly?100001:100000;sky.frustumCulled=false;sky.name=`Original sky: ${sourceSky.material}`;
    sky.userData.sourceFidelity='Original mesh, world transform, UV, native alpha, compiled pixel arithmetic and cooked time expressions; far-plane depth adaptation.';
    sky.userData.sourceComponent=sourceSky.component;scene.add(sky);
  }
  return sun;
}
