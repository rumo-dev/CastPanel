import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Archive,Backups } from '../src/main/archive';
import type { Comment } from '../src/shared/types';
test('archive preserves structured comments and limits search to date/platform',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'castpanel-archive-'));const archive=new Archive(dir);
 const c:Comment={id:'1',connectionId:'one',platform:'youtube',userId:'alice',username:'Alice',text:'hello\nworld',timestamp:'2026-10-27T12:00:00.000Z',emojis:[],gift:{kind:'superchat',label:'¥100',amount:100,currency:'JPY'}};
 await Promise.all([archive.write(c),archive.write({...c,id:'2',platform:'twitch',userId:'bob'})]);const result=await archive.search({query:'hello',from:'2026-10-27',to:'2026-10-27',platform:'youtube'});assert.equal(result.total,1);assert.equal(result.users,1);assert.equal(result.gifts,1);assert.equal(result.comments[0].text,'hello\nworld');assert.equal((await archive.search({query:'',from:'2026-10-28',to:'',platform:''})).total,0);
});
test('backup is readable, daily backup is deduplicated and traversal rejected',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'castpanel-backup-'));const backups=new Backups(dir);await backups.daily({version:1});await backups.daily({version:2});assert.equal((await backups.list()).length,1);const info=(await backups.list())[0];assert.deepEqual(await backups.read(info.name),{version:1});await assert.rejects(backups.read('../config.json'));
});
test('old CastPanel text logs import once and preserve gift labels',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'castpanel-legacy-'));await writeFile(path.join(dir,'2026-10-27_youtube.txt'),'2026-10-27T12:00:00.000Z\tAlice\tHello\t¥100\ninvalid line\n');const archive=new Archive(dir);await archive.importLegacy();await archive.importLegacy();const result=await archive.search({query:'Hello',from:'',to:'',platform:''});assert.equal(result.total,1);assert.equal(result.comments[0].gift?.label,'¥100');
});
