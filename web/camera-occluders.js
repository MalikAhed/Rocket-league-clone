// Authored cage and banner meshes only. Terrain, buildings, trees, bleachers,
// lighting towers and the pitch stay opaque. Wall trim fades only outside.
const cage=new Set(['FieldFrame_Outer','Field_STD_Glass','Field_STD_Glow','Field_STD_Net','Field_STD_NetLines','Field_STD_NetPosts','Goal_Frame','Goal_Frame_Quarterpipe','Goal_STD_Glass','Goal_STD_Glass_Outer','Goal_STD_Outer','Side_Frame','Side_Trim_Park']);
export function isCameraOccluder(name){return cage.has(name)||name.startsWith('AdvertStrip_')||name.startsWith('Park_Banner');}

