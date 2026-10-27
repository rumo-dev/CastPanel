import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const pkg=JSON.parse(await readFile('package.json','utf8'));
const tag=process.env.RELEASE_TAG;
if(tag!==`v${pkg.version}`)throw Error('Release tag must match package.json');
const gh=(args)=>spawnSync('gh',args,{stdio:'inherit',shell:false});
const files=(await readdir('release')).filter(name=>/\.(exe|dmg|zip|AppImage|blockmap)$/.test(name)||/^latest.*\.yml$/.test(name));
const required=process.platform==='win32'?['.exe','latest.yml']:process.platform==='darwin'?['.dmg','.zip','latest-mac.yml']:['.AppImage','latest-linux.yml'];
for(const item of required)if(!files.some(name=>item.startsWith('.')?name.endsWith(item):name===item))throw Error('Missing release artifact: '+item);
if(gh(['release','view',tag]).status!==0){
  const create=gh(['release','create',tag,'--verify-tag','--draft','--title',`CastPanel ${pkg.version}`,'--notes-file',`docs/releases/${tag}.md`]);
  // Another OS job may have created this draft concurrently.
  if(create.status!==0&&gh(['release','view',tag]).status!==0)throw Error('Cannot create release');
}
const upload=gh(['release','upload',tag,...files.map(name=>path.join('release',name)),'--clobber']);
if(upload.status!==0)throw Error('Release asset upload failed');
console.log(`Uploaded ${files.length} artifacts to ${tag}; existing release visibility preserved.`);
