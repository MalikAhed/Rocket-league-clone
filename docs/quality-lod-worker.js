import {MeshoptSimplifier} from './vendor/meshopt_simplifier.js';

// Offline-style mesh reduction lives on a worker: it never blocks controller
// polling, physics or rendering and its WASM memory is released when finished.
export async function simplifyLOD(data){
  await MeshoptSimplifier.ready;
  const {indices,positions,values,stride,weights,limits}=data,result={};
  for(const [level,ratio,error]of [['balanced',.6,limits[0]],['low',.3,limits[1]]]){
   const target=Math.max(3,Math.floor(indices.length*ratio/3)*3);
   [result[level]]=MeshoptSimplifier.simplifyWithAttributes(indices,positions,3,values,stride,weights,null,target,error,['ErrorAbsolute','Permissive']);
  }
  if(result.low.length>result.balanced.length)result.low=result.balanced.slice();
  return result;
}
if(typeof self!=='undefined')self.onmessage=async({data})=>{
 try{const result=await simplifyLOD(data);self.postMessage(result,[result.balanced.buffer,result.low.buffer]);}
 catch(error){self.postMessage({error:error.message});}
};
