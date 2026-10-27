import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudio,commandSchema } from '../src/shared/studio';
import { applyCommand } from '../src/main/studio';
import { formatTimestamp } from '../src/shared/poll';

test('editing a song preserves identity, completion and ordering',()=>{
 const studio=emptyStudio();applyCommand(studio,[],{type:'setlist-add',title:'Before',artist:'Old'});const song=studio.setlist[0];applyCommand(studio,[],{type:'setlist-update',id:song.id,action:'done'});applyCommand(studio,[],{type:'setlist-edit',id:song.id,title:'After',artist:'New'});assert.equal(studio.setlist[0].id,song.id);assert.equal(studio.setlist[0].title,'After');assert.equal(studio.setlist[0].done,true);
});
test('manual stream start accepts the past, rejects the future and preserves recorded offsets',()=>{
 const studio=emptyStudio();studio.timestamps=[{id:'a',seconds:10,label:'Old'}];const startedAt=new Date(Date.now()-100000).toISOString();applyCommand(studio,[],{type:'stream-time',startedAt});assert.equal(studio.streamStartedAt,startedAt);assert.equal(studio.timestamps[0].seconds,10);assert.throws(()=>applyCommand(studio,[],{type:'stream-time',startedAt:new Date(Date.now()+60000).toISOString()}));
});
test('timestamp edits sort the timeline and deletion removes the requested entry',()=>{
 const studio=emptyStudio();studio.timestamps=[{id:'a',seconds:10,label:'A'},{id:'b',seconds:20,label:'B'}];applyCommand(studio,[],{type:'timestamp-edit',id:'b',seconds:5,label:'Edited'});assert.equal(studio.timestamps[0].id,'b');assert.equal(studio.timestamps[0].label,'Edited');applyCommand(studio,[],{type:'timestamp-remove',id:'a'});assert.equal(studio.timestamps.length,1);assert.equal(formatTimestamp(3661),'01:01:01');assert.equal(commandSchema.safeParse({type:'timestamp-edit',id:'b',seconds:-1,label:'Wrong'}).success,false);
});
