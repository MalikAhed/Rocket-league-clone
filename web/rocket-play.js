import * as THREE from 'three';
import {geometryLoader} from './geometry-loader.js';
import {PhysicsSimulation} from './soccer/physics/simulation.js';
import {resolvePhysicsSelection} from './soccer/physics/presets.js';
import {PhysicsClock} from './soccer/physics/clock.js';
import {createControllerReader} from './controller.js';
import {bindings} from './bindings.js';
import {createKeyboardReader} from './keyboard-controls.js';
import {setupCameraSettings} from './camera-settings-ui.js';
import {loadCameraBoundary} from './camera-obstruction.js';
import {setCameraVisibility} from './camera-visibility.js';
import {keepCameraAboveGround} from './chase-ground.js';
import {createCameraContact} from './camera-contact.js';
import {updateNetBall} from './recovered-net.js';
import {createRecoveredVehicle,prepareVehicleGeometry} from './recovered-vehicles.js';
import {loadOriginalFennec} from './original-fennec.js';
import {createOriginalBoost} from './original-boost.js';
import {createVehicleEffects} from './vehicle-effects.js';
import {createGoalExplosion} from './goal-explosion.js';
import {createGoalPhysics} from './goal-physics.js';
import {MatchDriver} from './match-driver.js';
import {optimizeSceneUniforms} from './compact-uniforms.js';
import {setGameplayPostEffects} from './gameplay-postfx.js';
// Uses the supplied Car Soccer runtime. No custom collision/vehicle solver here.
export async function createPlay(scene,camera,canvas){
 const sim=new PhysicsSimulation(resolvePhysicsSelection('?physics=experimental&hitbox=octane','fennec'));
 const loader=geometryLoader();
 const [originalCar,ballAsset,ballMaterial,,cameraBoundary]=await Promise.all([loadOriginalFennec(),loader.loadAsync('./assets/original/ball/Ball_DefaultBall00.gltf'),createRecoveredVehicle('Ball'),sim.init(),loadCameraBoundary()]);
 sim.dodgeDeadzone=bindings.dodgeDeadzone;sim.configureCars('fennec',false,0);sim.setUnlimitedBoost(true);
 const unlimited=document.querySelector('#unlimited-boost');unlimited.checked=true;
 unlimited.addEventListener('change',()=>sim.setUnlimitedBoost(unlimited.checked));
 const root=new THREE.Group();root.scale.setScalar(.01);scene.add(root);
 const car=originalCar;root.add(car);
 const wheels=car.userData.wheels??[];
 const ball=ballAsset.scene;ball.name='Rocket League ball';ball.updateMatrixWorld(true);
 let radius=0;
 ball.traverse(n=>{if(n.isMesh){n.geometry=prepareVehicleGeometry(n.geometry.clone());n.material=ballMaterial;n.castShadow=true;const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld);radius=Math.max(radius,v.length());}}});
 // Visual radius is 92.75 uu; RocketSim collision radius is separately 91.25 uu.
 ball.scale.multiplyScalar(92.75/radius);root.add(ball);
 canvas.dataset.ballAsset='Ball_Default.Meshes.Ball_DefaultBall00';canvas.dataset.vehicleSurfaces='body,chassis,ball';
 const padData=sim.getPads(),padMatrix=new THREE.Matrix4(),padVisibility=new Array(padData.length);
 const pads=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:0xffbe35}),padData.length);
 pads.name='Instanced boost pickup indicators';pads.frustumCulled=false;root.add(pads);
 const shadowMaterial=new THREE.MeshBasicMaterial({color:0x101811,transparent:true,opacity:.25,depthWrite:false});
 const shadows=[75,95].map(r=>{const s=new THREE.Mesh(new THREE.CircleGeometry(r,24),shadowMaterial);s.rotation.x=-Math.PI/2;root.add(s);return s;});
 const boostEffect=await createOriginalBoost();car.add(boostEffect.object);
 const [vehicleEffects,goalEffect]=await Promise.all([createVehicleEffects(scene,car,camera,sim.carConfigs[0]),createGoalExplosion(scene)]);
 const goalPhysics=await createGoalPhysics(sim),goalPosition=new THREE.Vector3();
 const settings=setupCameraSettings(()=>{sim.resetView();});
 const clock=new PhysicsClock(sim,{ballOffset:4});
 let keyboard;const hud=document.querySelector('#play-hud');
 const controllerStatus=document.querySelector('#controller-status');
 const cameraLook=new THREE.Vector3();let lastHUD='';
 const readController=createControllerReader();let gamepad=readController();
 let userPaused=false,previewGarage=false,previewAngle=0,opponent=null,opponentBoost=null,opponentEffects=null,opponentShadow=null,api;
 const opponentState=new Float32Array(sim.state.length);
 let active=false,ballCam=settings.ballCam,score=[0,0],goalUntil=0,spin=0,lastThrottle=0;
 const basis=new THREE.Matrix4(),f=new THREE.Vector3(),r=new THREE.Vector3(),u=new THREE.Vector3();
 const view=new Float64Array(32);
 function vector(s,o){return new THREE.Vector3(s[o],s[o+2],s[o+1]);}
 function syncObject(object,s,o){object.position.copy(vector(s,o));f.copy(vector(s,o+3));r.copy(vector(s,o+6));u.copy(vector(s,o+9));object.quaternion.setFromRotationMatrix(basis.makeBasis(f,u,r));}
 const match=new MatchDriver(sim,padData,{
  onKickoff(){keyboard?.clear();setCameraVisibility(camera,null);clock.sync();goalUntil=0;lastThrottle=0;ball.visible=true;car.visible=true;vehicleEffects.reset();goalEffect.reset();goalPhysics.reset();boostEffect.reset();opponentEffects?.reset();opponentBoost?.reset();sync();},
  onGoal(sign,flag){score[flag===1?0:1]++;goalUntil=1;const gs=sim.state;goalPosition.set(gs[4],gs[6],gs[5]).multiplyScalar(.01);goalEffect.trigger(sign,goalPosition);goalPhysics.trigger(sign,gs);ball.visible=false;},
  onEnd(state){api.setPaused(true);api.onMatchEnd?.(state);},
  onError(message){api.setPaused(true);api.onError?.(message);}
 });
 function reset(){match.resetKickoff();}
 async function loadOpponent(){
  if(opponent)return;
  const model=await loadOriginalFennec(),boost=await createOriginalBoost();model.add(boost.object);
  const effects=await createVehicleEffects(scene,model,camera,sim.carConfigs[0]);
  opponent=model;opponentBoost=boost;opponentEffects=effects;opponent.visible=false;root.add(opponent);
  opponentShadow=shadows[0].clone();opponentShadow.visible=false;root.add(opponentShadow);optimizeSceneUniforms(scene);
 }
 function sync(){const s=sim.state;syncObject(car,s,22);syncObject(ball,s,4);car.visible=s[43]!==1;
  if(opponent){opponent.visible=active&&match.mode==='offline'&&s[94]!==1;opponentShadow.visible=opponent.visible;if(opponent.visible){syncObject(opponent,s,73);opponentShadow.position.set(opponent.position.x,3,opponent.position.z);}}shadows[0].position.set(car.position.x,3,car.position.z);shadows[1].position.set(ball.position.x,3,ball.position.z);shadows[1].visible=ball.visible;
  updateNetBall(s[4],s[5],s[6]);
  let padsChanged=false;
  for(let i=0;i<padData.length;i++){const visible=s[430+i*2]!==0;if(padVisibility[i]===visible)continue;
   padVisibility[i]=visible;const p=padData[i],radius=visible?(p.isBig?24:7):0;
   padMatrix.makeScale(radius,radius,radius).setPosition(p.pos[0],p.isBig?75:14,p.pos[1]);pads.setMatrixAt(i,padMatrix);padsChanged=true;
  }
  if(padsChanged)pads.instanceMatrix.needsUpdate=true;
 }
 function ballAction(action){if(!active||userPaused||match.mode!=='freeplay')return;keyboard?.clear();goalUntil=0;match.goalTicks=0;ball.visible=true;goalEffect.reset();goalPhysics.reset();vehicleEffects.reset();boostEffect.reset();sim.controlBall(0,action);clock.sync();sync();document.querySelector('#freeplay-status').textContent={takePossession:'Ball placed ahead of the car.',startDribble:'Dribble setup ready.',passBall:'Pass sent toward your car.',launchBall:'Ball launched.'}[action];canvas.focus();}
 for(const button of document.querySelectorAll('[data-ball-action]'))button.onclick=()=>ballAction(button.dataset.ballAction);
 document.querySelector('#freeplay-kickoff').onclick=()=>{reset();canvas.focus();};
 const paused=()=>userPaused||Boolean(document.querySelector('dialog[open]'));
 for(const panel of document.querySelectorAll('dialog'))panel.addEventListener('close',()=>{clock.sync();canvas.focus();});
 keyboard=createKeyboardReader(canvas,{active:()=>active,paused,onAction:action=>{
  if(action==='camera'){if(settings.toggleBallCam)ballCam=!ballCam;}
  else if(action==='reset'){if(match.mode==='freeplay')reset();}
  else ballAction({bringBall:'startDribble',takePossession:'takePossession',launchBall:'launchBall',passBall:'passBall'}[action]);
 }});
 window.addEventListener('blur',()=>clock.sync());
 function controls(){const k=keyboard.sample(clock.dt);const input={throttle:k.throttle||gamepad.throttle,steer:k.steer||gamepad.steer,pitch:k.pitch||gamepad.pitch,yaw:k.yaw||gamepad.yaw,roll:k.roll||gamepad.roll,jump:k.jump||gamepad.jump,boost:k.boost||gamepad.boost,handbrake:k.handbrake||gamepad.handbrake};const result=effectChecks?effectChecks.controls(input):input;lastThrottle=result.throttle;return result;}
 window.addEventListener('player-controls-applied',()=>{if(sim.dodgeDeadzone!==bindings.dodgeDeadzone){sim.dodgeDeadzone=bindings.dodgeDeadzone;sim.configureCars('fennec',false,0);if(match.mode==='offline')sim.addCar(1,'default');sim.setUnlimitedBoost(match.mode==='freeplay');reset();}});
 const cfg=sim.carConfigs[0],hitbox=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(cfg.fullSize[0],cfg.fullSize[2],cfg.fullSize[1])),new THREE.LineBasicMaterial({color:0x70ffff,depthTest:false}));
 hitbox.position.set(cfg.offset[0],cfg.offset[2],cfg.offset[1]);hitbox.renderOrder=100;hitbox.visible=false;car.add(hitbox);
 document.querySelector('#show-hitbox').onchange=e=>hitbox.visible=e.target.checked;
 const contactNormal=createCameraContact(cameraBoundary,cfg),cameraGroundNormal=new THREE.Vector3(0,1,0);let contactTick=-1;
 const cameraAnchor=new THREE.Vector3(),cameraAim=new THREE.Vector3(),cameraDirection=new THREE.Vector3(),carUp=new THREE.Vector3(),carForward=new THREE.Vector3();let lastCameraReport=0;
 canvas.dataset.physicsProfile=JSON.stringify({engine:'RocketSim',steeringSensitivity:bindings.steeringSensitivity,aerialSensitivity:bindings.aerialSensitivity,controllerDeadzone:bindings.deadzone,dodgeDeadzone:sim.dodgeDeadzone,hitbox:cfg,visualBallRadius:92.75,collisionBallRadius:sim.ballRadius});
 reset();
 const effectChecks=new URLSearchParams(location.search).has('effectsChecks')?(await import('./effect-checks.js')).createEffectChecks(sim,reset):null;
 const cameraChecks=new URLSearchParams(location.search).has('cameraChecks')?(await import('./camera-checks.js')).createCameraChecks(sim):null;
 api={get active(){return active},get boost(){return sim.state[40]},get matchState(){return match.session.state},get celebrating(){return !!goalUntil},reset,
 setPaint(paint){car.userData.bodyMaterial.userData.setPaint(paint);},
 async start(mode,botId,orangePaint){
  if(mode==='offline')await loadOpponent();
  await match.start(mode,botId);unlimited.checked=mode==='freeplay';score=[0,0];
  if(opponent&&orangePaint)opponent.userData.bodyMaterial.userData.setPaint(orangePaint);
  active=true;userPaused=false;root.visible=true;pads.visible=true;ball.visible=true;shadows.forEach(n=>n.visible=true);
  setGameplayPostEffects(vehicleEffects,goalEffect,true);clock.sync();canvas.focus();sync();
 },
 setPaused(value){userPaused=value;match.setPaused(value);keyboard?.clear();clock.sync();},
 leave(){match.leave();api.setActive(false);api.preview(false);},
 mapOnly(){root.visible=false;pads.visible=false;car.visible=false;ball.visible=false;shadows.forEach(n=>n.visible=false);},
 preview(garage=false){previewGarage=garage;root.visible=true;car.visible=true;ball.visible=false;pads.visible=false;shadows[1].visible=false;if(opponent)opponent.visible=false;if(opponentShadow)opponentShadow.visible=false;car.position.set(0,17,-2500);car.quaternion.identity();shadows[0].position.set(0,3,-2500);shadows[0].visible=true;api.updatePreview(0);},
 updatePreview(dt){if(active)return;previewAngle+=dt*.08;car.rotation.y=previewGarage?Math.sin(previewAngle)*.18:0;camera.up.set(0,1,0);camera.fov=42;camera.position.set(3.5,1.8,-22.5);camera.lookAt(-1,.4,-24);camera.updateProjectionMatrix();},
 setActive(value){active=value;userPaused=false;setCameraVisibility(camera,null);setGameplayPostEffects(vehicleEffects,goalEffect,value);keyboard?.clear();hud.hidden=!value;if(value){match.paused=false;reset();pads.visible=true;canvas.focus();}else{vehicleEffects.reset();goalEffect.reset();goalPhysics.reset();boostEffect.reset();opponentEffects?.reset();opponentBoost?.reset();}clock.sync();},
 update(dt){if(!active)return;
  if(paused()){keyboard?.clear();clock.sync();return;}
  gamepad=readController();if(controllerStatus.textContent!==gamepad.status)controllerStatus.textContent=gamepad.status;
  if(settings.toggleBallCam){if(gamepad.cameraPressed)ballCam=!ballCam;}else ballCam=gamepad.camera||keyboard.held('camera');
  if(gamepad.resetPressed&&match.mode==='freeplay')reset();
  if(gamepad.bringBallPressed)ballAction('startDribble');
  if(gamepad.takePossessionPressed)ballAction('takePossession');if(gamepad.launchBallPressed)ballAction('launchBall');if(gamepad.passBallPressed)ballAction('passBall');
  const now=performance.now();
  if(!cameraChecks)clock.update(now,()=>sim.setControls(0,controls()),()=>{
   if(!match.tick())return false;
   goalPhysics.update(clock.dt);
   // Sample moving attachments at every 120 Hz physics tick, including turns,
   // air rolls and the celebration. Render frequency must not change trails.
   syncObject(car,sim.state,22);vehicleEffects.update(clock.dt,sim.state);
   boostEffect.update(clock.dt,sim.state[45]===1,Math.abs(lastThrottle)>.01);
   if(opponent&&match.mode==='offline'){
    syncObject(opponent,sim.state,73);opponentState.set(sim.state);opponentState.copyWithin(22,73,124);
    opponentEffects.update(clock.dt,opponentState);opponentBoost.update(clock.dt,sim.state[96]===1,Math.abs(match.bot?.controls.throttle??0)>.01);
   }
   return true;
  });
  if(cameraChecks){ballCam=cameraChecks.apply().ballCam;clock.sync(now);}
  sync();if(goalUntil)ball.position.copy(goalPosition).multiplyScalar(100);const s=sim.state;goalEffect.update(dt);car.userData.chassisMaterial.userData.nativeScalars.BoostGlowIntensity=s[45]===1?1:0;if(opponent&&match.mode==='offline'){opponent.userData.chassisMaterial.userData.nativeScalars.BoostGlowIntensity=s[96]===1?1:0;for(const wheel of opponent.userData.wheels)wheel.rotation.z-=vector(s,85).length()*dt/15;}const speed=vector(s,34).length();spin+=speed*dt/15;for(const wheel of wheels)wheel.rotation.z=-spin;
  if(s[41]===1&&(contactTick!==s[0]||cameraChecks)){contactNormal(car,s,cameraGroundNormal);contactTick=s[0];}
  view[0]=Math.min(dt,.05);view[1]=ballCam?1:0;view.set(car.position.toArray(),2);view.set(car.quaternion.toArray(),5);view.set(ball.position.toArray(),9);view[12]=15;view[13]=s[41];view.set(cameraGroundNormal.toArray(),14);view.set(vector(s,34).toArray(),17);view[20]=s[42];
  const kview=keyboard.sample(0);view.set([settings.fov,settings.distance,settings.height,settings.angle,settings.stiffness,settings.transitionSpeed,camera.aspect,kview.lookX||gamepad.lookX,kview.lookY||gamepad.lookY,settings.swivelSpeed,settings.invertSwivel?1:0],21);
  const v=sim.stepView(view);camera.position.set(v[32]/100,v[33]/100,v[34]/100);camera.up.set(v[38],v[39],v[40]).normalize();
  carUp.set(0,1,0).applyQuaternion(car.quaternion);carForward.set(1,0,0).applyQuaternion(car.quaternion);
  cameraAnchor.copy(car.position).multiplyScalar(.01).addScaledVector(carUp,.22);
  cameraDirection.set(v[35],v[36],v[37]).normalize();cameraAim.copy(camera.position).addScaledVector(cameraDirection,Math.max(.2,camera.position.distanceTo(cameraAnchor)));
  if(gamepad.rearView||kview.rearView){camera.position.copy(car.position).multiplyScalar(.01).addScaledVector(carForward,settings.distance*.01).addScaledVector(carUp,settings.height*.01);cameraAim.copy(cameraAnchor);}
  if(camera.fov!==v[41]){camera.fov=v[41];camera.updateProjectionMatrix();}
  cameraDirection.subVectors(cameraAim,camera.position).normalize();
  if(Math.abs(cameraDirection.dot(camera.up))>.98)camera.up.copy(carUp);if(Math.abs(cameraDirection.dot(camera.up))>.98)camera.up.set(0,0,1);
  if(settings.shake&&s[45]===1){camera.position.addScaledVector(camera.up,Math.sin(now*.09)*.012);}
  const floorLift=keepCameraAboveGround(camera,cameraAim);camera.lookAt(cameraAim);
  if(cameraChecks)vehicleEffects.update(dt,s);
  const exteriorPlane=cameraBoundary.exteriorPlane(cameraAnchor,camera.position);setCameraVisibility(camera,exteriorPlane);
  if(now-lastCameraReport>500){canvas.dataset.cameraState=JSON.stringify({ballCam,grounded:s[41]===1,wall:s[41]===1&&Math.abs(cameraGroundNormal.y)<.7,surfaceNormal:cameraGroundNormal.toArray(),position:camera.position.toArray(),car:car.position.clone().multiplyScalar(.01).toArray(),forward:carForward.toArray(),up:carUp.toArray(),floorLift,exteriorCut:exteriorPlane?.toArray()??null,look:[view[28],view[29]]});lastCameraReport=now;}

  const hudText=`Fennec · RocketSim 120 Hz · ${score[0]}:${score[1]} · Boost ${unlimited.checked?'∞':Math.round(s[40])} · ${Math.round(speed*.036)} km/h · ${ballCam?'Ball cam':'Car cam'}${goalUntil?' · GOAL!':''}`;
  if(hudText!==lastHUD){hud.textContent=hudText;lastHUD=hudText;}
 }};
 return api;
}



