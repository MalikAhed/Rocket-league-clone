// Explicit diagnostic URL only: ?cameraChecks. Uses the normal rendering and
// camera path with stationary physics poses, so wall cases are reproducible.
export function createCameraChecks(sim){
 const cases={
  'Ground car cam / ball behind':{pos:[0,0,17],f:[0,1,0],u:[0,0,1],ball:[0,-1500,92.75],ballCam:false},
  'Ground car cam / ball ahead':{pos:[0,0,17],f:[0,1,0],u:[0,0,1],ball:[0,1500,92.75],ballCam:false},
  'Ground ball cam / ball behind':{pos:[0,0,17],f:[0,1,0],u:[0,0,1],ball:[0,-1500,92.75],ballCam:true},
  'Outside side wall / ball cam':{pos:[4075,0,600],f:[0,1,0],u:[-1,0,0],ball:[-1500,0,92.75],ballCam:true},
  'Outside end wall / car cam':{pos:[2000,4980,17],f:[0,-1,0],u:[0,0,1],ball:[2000,5500,92.75],ballCam:false},
  'Driving up wall / car cam':{pos:[4075,0,200],f:[0,0,1],u:[-1,0,0],ball:[0,0,92.75],ballCam:false},
  'Driving across wall / car cam':{pos:[4075,0,600],f:[0,1,0],u:[-1,0,0],ball:[0,0,92.75],ballCam:false},
 };
 const panel=document.createElement('label');panel.style.cssText='position:absolute;bottom:48px;left:12px;z-index:10;background:#11231f;padding:8px';panel.textContent='Camera check ';
 const select=document.createElement('select');select.setAttribute('aria-label','Camera check');for(const name of Object.keys(cases))select.add(new Option(name,name));panel.append(select);document.querySelector('#viewport').append(panel);
 select.onchange=()=>sim.resetView();const saved=sim.state.slice();
 return {apply(){const c=cases[select.value],s=sim.state;s.set(saved);s.set(c.pos,22);s.set(c.f,25);const [fx,fy,fz]=c.f,[ux,uy,uz]=c.u;s.set([uy*fz-uz*fy,uz*fx-ux*fz,ux*fy-uy*fx],28);s.set(c.u,31);s.fill(0,34,40);s[41]=1;s[42]=0;s[45]=0;s.set(c.u,60);s.set(c.ball,4);return c;}};
}
