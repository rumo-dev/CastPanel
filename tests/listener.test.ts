import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordListener } from '../src/shared/listener';
import type { Comment,Listener } from '../src/shared/types';
import { emptyStudio } from '../src/shared/studio';
import { applyCommand } from '../src/main/studio';
const comment=(name:string,time='2026-10-27T12:00:00.000Z'):Comment=>({id:time,connectionId:'a',platform:'youtube',userId:'same-id',username:name,text:'hello',timestamp:time,emojis:[]});
test('name history captures changes and reversions without duplicating unchanged names',()=>{
 let listener=recordListener(undefined,comment('Alice'));listener=recordListener(listener,comment('Alice'));listener=recordListener(listener,comment('Alicia','2026-10-27T12:01:00.000Z'));listener=recordListener(listener,comment('Alice','2026-10-27T12:02:00.000Z'));assert.deepEqual(listener.nameHistory?.map(entry=>entry.name),['Alice','Alicia','Alice']);assert.equal(listener.count,4);assert.equal(listener.firstSeen,'2026-10-27T12:00:00.000Z');
});
test('old listener records migrate and history stays bounded',()=>{
 let listener:Listener={firstSeen:'2026-10-26T12:00:00.000Z',lastSeen:'2026-10-26T12:00:00.000Z',username:'Old',count:2,gifts:[]};listener=recordListener(listener,comment('New'));assert.deepEqual(listener.nameHistory?.map(entry=>entry.name),['Old','New']);for(let i=0;i<30;i++)listener=recordListener(listener,comment(`Name${i}`));assert.equal(listener.nameHistory?.length,20);assert.equal(listener.count,33);
});
test('nickname edits and mute/block actions preserve icon permission records',()=>{
 const studio=emptyStudio();studio.profiles['youtube:same-id']={nickname:'Alias',memo:'',blocked:false,muted:false,iconPermission:'denied'};applyCommand(studio,[],{type:'profile',key:'youtube:same-id',profile:{nickname:'New alias',memo:'',blocked:false,muted:true}});assert.equal(studio.profiles['youtube:same-id'].iconPermission,'denied');
});
