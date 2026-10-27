import { readFile,access } from 'node:fs/promises';
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const builder=await readFile(new URL('../electron-builder.yml',import.meta.url),'utf8');
if(/REPLACE_OWNER|REPLACE_REPO|YOUR_GITHUB/.test(builder))throw Error('GitHub Releasesの配布先を設定してください');
const tag=process.env.RELEASE_TAG;
if(tag&&tag!=='v'+pkg.version)throw Error(`タグ ${tag} と package.json ${pkg.version} が一致しません`);
for(const file of ['build/icon.png','build/icon.ico','build/icon.icns','vendor/sanka/package.json'])await access(new URL('../'+file,import.meta.url));
console.log(`Release configuration ready: v${pkg.version} → rumo-dev/CastPanel (publishing is not performed by this check)`);
