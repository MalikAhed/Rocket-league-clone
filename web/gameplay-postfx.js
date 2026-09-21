import * as THREE from 'three';
// Scene-colour distortion shares the existing HDR resolve. This is a browser
// reconstruction, not the native UE3 distortion-buffer or post-process shader.
let vehicle=null,goal=null,active=false;
const projected=new THREE.Vector3(),viewPosition=new THREE.Vector3();
export const gameplayPostUniforms={
 gameplayDistortion:{value:new THREE.Vector4(0,0,0,0)},
 gameplayDistortionPhase:{value:0},gameplaySpeed:{value:0},gameplayAspect:{value:1},
};
export function setGameplayPostEffects(v,g,enabled){vehicle=v;goal=g;active=enabled;}
export function updateGameplayPost(camera){
 const u=gameplayPostUniforms;u.gameplaySpeed.value=active?(vehicle?.supersonic??0):0;
 u.gameplayAspect.value=camera.aspect;
 const jump=active?vehicle?.distortion:null,explosion=active?goal?.distortion:null;
 const d=explosion?.active?explosion:jump;
 u.gameplayDistortion.value.set(0,0,0,0);
 if(!d?.active||!d.position||!(d.radius>0))return;
 viewPosition.copy(d.position).applyMatrix4(camera.matrixWorldInverse);
 if(viewPosition.z>=-camera.near)return;
 projected.copy(d.position).project(camera);
 if(projected.z>1)return;
 const radius=Math.min(.8,d.radius/(-viewPosition.z*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)))*.5);
 u.gameplayDistortion.value.set(projected.x*.5+.5,projected.y*.5+.5,radius,Math.min(1,Math.max(0,d.strength??1)));
 u.gameplayDistortionPhase.value=d.age??0;
}
export const gameplayPostGLSL=`
 uniform vec4 gameplayDistortion;
 uniform float gameplayDistortionPhase,gameplaySpeed,gameplayAspect;
 vec3 gameplaySceneColour(sampler2D source,vec2 uv){
  if(gameplayDistortion.w<=0.&&gameplaySpeed<=.001)return texture2D(source,uv).rgb;
  vec2 offset=vec2(0.);
  if(gameplayDistortion.w>0.){
   vec2 q=(uv-gameplayDistortion.xy)*vec2(gameplayAspect,1.);
   float r=length(q)/max(.0001,gameplayDistortion.z);
   float mask=(1.-smoothstep(.6,1.,r))*smoothstep(0.,.12,r);
   float wave=sin(r*24.-gameplayDistortionPhase*45.);
   offset=normalize(q+vec2(.00001))*vec2(1./gameplayAspect,1.)*wave*mask*gameplayDistortion.w*.0025;
  }
  vec2 sampleUv=clamp(uv+offset,vec2(.001),vec2(.999));
  vec3 colour=texture2D(source,sampleUv).rgb;
  if(gameplaySpeed>.001){
   vec2 q=uv-.5;float edge=smoothstep(.28,.7,length(q));
   // Subtle peripheral speed smear; keep center, tones and lighting intact.
   vec3 peripheral=texture2D(source,clamp(sampleUv-q*.016*gameplaySpeed,vec2(.001),vec2(.999))).rgb;
   colour=mix(colour,peripheral,edge*gameplaySpeed*.22);
  }
  return colour;
 }
`;
