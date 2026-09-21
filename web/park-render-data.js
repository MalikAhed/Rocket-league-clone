// Reproducibly extracted from the user's cooked Park_P package.
const response = await fetch('./assets/original/render-evidence.json');
if (!response.ok) throw new Error(`Park render data: HTTP ${response.status}`);
export const parkSource = await response.json();
export const sourceMaterial = name => parkSource.materials[name];
// FColor is serialized BGRA. Material LinearColor values are already linear.
export const bgraRGB = value => [value[2] / 255, value[1] / 255, value[0] / 255];
// Original FLinearColor(FColor) uses a gamma-2.2 lookup table (RVA 0x21D9120).
export const fcolorLinearRGB=value=>bgraRGB(value).map(channel=>Math.pow(channel,2.2));
const pipelineResponse=await fetch('./assets/original/lighting-pipeline-evidence.json');
if(!pipelineResponse.ok)throw new Error(`Park lighting pipeline: HTTP ${pipelineResponse.status}`);
export const parkLightingPipeline=await pipelineResponse.json();

// These are explicit port choices, separated from recovered source values.
export const parkPort = Object.freeze({
  cloudScale: 0.33,
  cloudCoverage: [0.56, 0.64],
  paintGain: 5,
  wearRange: [0.012, 0.25],
});
