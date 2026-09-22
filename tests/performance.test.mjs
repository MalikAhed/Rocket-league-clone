import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePerformance} from '../web/performance-settings.js';
test('uncapped is the default; explicit limits and valid saved choices survive',()=>{
 assert.deepEqual(normalizePerformance(),{mode:'uncapped',cap:0,scale:.6,showFPS:true});
 assert.deepEqual(normalizePerformance({mode:'display',cap:144,scale:.8,showFPS:false}),{mode:'display',cap:144,scale:.8,showFPS:false});
 assert.equal(normalizePerformance({cap:0}).cap,0);
 for(const value of [null,42,'broken',{cap:'NaN',scale:8,mode:'unknown'}])assert.deepEqual(normalizePerformance(value),normalizePerformance());
 assert.equal(normalizePerformance({cap:2000}).cap,1000);
 assert.equal(normalizePerformance({cap:-10}).cap,0);
});
test('gameplay resources remain inside a nested Pages deployment',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const file of ['physics/source-runtime.js','physics/simulation.js','physics/experimental-runtime.js','bots/catalog.js']){
  const source=await readFile(new URL('../web/soccer/'+file,import.meta.url),'utf8');
  assert(!/["'`]\/(?:assets|physics)\//.test(source),file+' must not use origin-root URLs');
  for(const match of source.matchAll(/new URL\("([^"]+)", import.meta.url\)/g)){
   const url=new URL(match[1],'https://example.test/Rocket-league-clone/docs/soccer/'+file);
   assert(url.pathname.startsWith('/Rocket-league-clone/docs/'),url.href);
  }
 }
});
