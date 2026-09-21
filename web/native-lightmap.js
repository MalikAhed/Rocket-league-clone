// Original directional vertex-lightmap VS: BGRA -> gamma 2.2 -> coefficient scale.
// Decode before raster interpolation; decoding an interpolated byte value differs.
export function decodeVertexLightmap(raw,offset,scale){
 return [2,1,0].map((channel,i)=>{
  const encoded=Math.fround(raw[offset+channel]/255);
  if(encoded===0)return 0;
  const exponent=Math.fround(Math.fround(Math.log2(encoded))*Math.fround(2.2));
  return Math.fround(Math.fround(2**exponent)*scale[i]);
 });
}
