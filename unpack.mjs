// Optional: materialize the exact packed asset files for editing or inspection.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {packedIndex,webRoot,readStoredAsset} from './storage.mjs';
for(const name of Object.keys(packedIndex)){
 const file=path.resolve(webRoot,name);
 if(!file.startsWith(webRoot))throw Error('Invalid packed path');
 await mkdir(path.dirname(file),{recursive:true});await writeFile(file,readStoredAsset(name));
}
console.log(`Expanded ${Object.keys(packedIndex).length} files into web/. The server prefers editable files over packed copies.`);
