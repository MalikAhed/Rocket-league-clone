import * as THREE from 'three';
import {parkSource, parkLightingPipeline, fcolorLinearRGB} from './park-render-data.js';

const source = parkSource.fog.props;
const colour = (bytes, gain) => new THREE.Color().setRGB(...fcolorLinearRGB(bytes)).multiplyScalar(gain);
const nativeFog=parkLightingPipeline.nativeFog;
const angle=source.LightTerminatorAngle??parkLightingPipeline.fogClassDefaults.LightTerminatorAngle;
const cosine=THREE.MathUtils.clamp(Math.cos(angle*Math.PI/180),-.99999,.99999);
export const parkFogUniforms = {
  parkFogHeight: {value: source.FogHeight / parkSource.unitsPerMetre},
  parkFogDensity: {value: source.FogDensity * nativeFog.densityUnitScale * parkSource.unitsPerMetre},
  parkFogFalloff: {value: source.FogHeightFalloff * nativeFog.heightFalloffUnitScale * parkSource.unitsPerMetre},
  parkFogStart: {value: source.StartDistance / parkSource.unitsPerMetre},
  parkFogMax: {value: source.FogMaxOpacity},
  parkFogOpposite: {value: colour(source.OppositeLightColor, source.OppositeLightBrightness)},
  parkFogSun: {value: colour(source.LightInscatteringColor, source.LightInscatteringBrightness)},
  parkFogAngularPower: {value:Math.log(.5)/Math.log(.5-.5*cosine)},
  parkFogDirection: {value: new THREE.Vector3(...nativeFog.directionWebGL)},
};

// Height integral/order recovered from the installed game's
// TExponentialHeightFogPixelShader<MSAASF_NoMSAA> DXBC at offset 1915061.
// UE uses the full ray for the height integral, then subtracts StartDistance
// only from the optical distance. Native CPU setup also provides unit scaling,
// source gamma-2.2 color conversion, and the angular-color blend parameters.
export const parkFogGLSL = `
varying vec3 parkWorldPosition;
uniform float parkFogHeight, parkFogDensity, parkFogFalloff, parkFogStart, parkFogMax;
uniform float parkFogAngularPower;
uniform vec3 parkFogOpposite, parkFogSun, parkFogDirection;
vec4 parkHeightFogFactors(vec3 worldPosition) {
  vec3 ray = worldPosition - cameraPosition;
  float rayLength = length(ray);
  float lengthInFog = max(0.0, rayLength - parkFogStart);
  vec3 direction = ray / max(rayLength, 0.0001);
  float density = parkFogDensity * exp2(clamp(-parkFogFalloff * (cameraPosition.y-parkFogHeight), -80.0, 40.0));
  // DXBC substitutes +0.01 Unreal units for nearly horizontal height deltas.
  float heightDelta = abs(ray.y) > 0.0001 ? ray.y : 0.0001;
  float falloff = clamp(parkFogFalloff * heightDelta, -80.0, 80.0);
  // Stable series avoids cancellation on WebGL's float precision at the
  // source shader's near-horizontal substitute (mathematically equivalent).
  float integral = abs(falloff) > 0.01 ? (1.0-exp2(-falloff)) / falloff : 0.69314718-0.2402265*falloff+0.0555041*falloff*falloff;
  float fog = min(parkFogMax, 1.0-exp2(-max(0.0, density * lengthInFog * integral)));
  float oppositeWeight=pow(abs(0.5-0.499*dot(direction,parkFogDirection)),parkFogAngularPower);
  return vec4(mix(parkFogSun, parkFogOpposite, oppositeWeight)*fog,1.0-fog);
}
vec3 applyParkHeightFog(vec3 colour) {
  vec4 factors=parkHeightFogFactors(parkWorldPosition);
  return colour*factors.w+factors.xyz;
}
`;

export function withParkFog(material) {
  if (material.userData.parkHeightFog) return material;
  material.userData.parkHeightFog = true;
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.fog = false;
  material.onBeforeCompile = shader => {
    before.call(material, shader);
    Object.assign(shader.uniforms, parkFogUniforms);
    shader.vertexShader = 'varying vec3 parkWorldPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>
      vec4 parkFogVertex=vec4(transformed,1.0);
      #ifdef USE_BATCHING
        parkFogVertex=batchingMatrix*parkFogVertex;
      #endif
      #ifdef USE_INSTANCING
        parkFogVertex=instanceMatrix*parkFogVertex;
      #endif
      parkWorldPosition=(modelMatrix*parkFogVertex).xyz;`);
    shader.fragmentShader = parkFogGLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>',
      'gl_FragColor.rgb=applyParkHeightFog(gl_FragColor.rgb);\n#include <tonemapping_fragment>');
  };
  material.customProgramCacheKey = () => key + '|park-height-fog-v3';
  return material;
}
