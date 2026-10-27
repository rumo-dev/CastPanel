import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudio,commandSchema,pollSchema } from '../src/shared/studio';
import { applyCommand,processStudio } from '../src/main/studio';
import { publicState } from '../src/main/server';
import type { Comment,Snapshot } from '../src/shared/types';
const comment=(id:string,text:string,userId='alice'):Comment=>({id,connectionId:'one',platform:'youtube',userId,username:'Alice',text,timestamp:new Date().toISOString(),emojis:[]});
test('participation deduplicates users, removes withdrawals and counts completed turns',()=>{
 const s=emptyStudio();s.participation.enabled=true;const cooldown=new Map();
 processStudio(s,comment('1','参加希望'),cooldown);processStudio(s,comment('2','参加希望'),cooldown);assert.equal(s.participation.queue.length,1);
 applyCommand(s,[],{type:'queue',key:'youtube:alice',action:'done'});assert.equal(s.participation.history['youtube:alice'],1);
 processStudio(s,comment('3','参加希望'),cooldown);assert.equal(s.participation.queue[0].count,1);processStudio(s,comment('4','辞退'),cooldown);assert.equal(s.participation.queue.length,0);
});
test('poll counts latest vote once per platform user and ignores closed or invalid votes',()=>{
 const s=emptyStudio();applyCommand(s,[],{type:'poll-create',title:'Q',options:['A','B'],correct:1});
 for(const c of [comment('1','1'),comment('2','B'),comment('3','999'),comment('4','2','bob')])processStudio(s,c,new Map());
 assert.deepEqual(s.poll?.votes,{'youtube:alice':1,'youtube:bob':1});applyCommand(s,[],{type:'poll-toggle',active:false});processStudio(s,comment('5','1'),new Map());assert.equal(s.poll?.votes['youtube:alice'],1);
 assert.throws(()=>applyCommand(s,[],{type:'poll-create',title:'Bad',options:['A','B'],correct:3}));
 assert.equal(commandSchema.safeParse({type:'poll-create',title:'Q',options:['A','A'],correct:-1}).success,false);
});
test('effects obey cooldown; stock/pin persist; block removes current and pinned comments',()=>{
 const s=emptyStudio();s.rules=[{id:'r',word:'888',message:'{name}: {comment}',enabled:true,cooldown:60}];s.profiles['youtube:alice']={nickname:'アリス',memo:'',muted:false,blocked:false};const cooldown=new Map();const c=comment('1','888');
 assert.equal(processStudio(s,c,cooldown)[0].message,'アリス: 888');assert.equal(processStudio(s,c,cooldown).length,0);
 applyCommand(s,[c],{type:'stock',id:c.id});applyCommand(s,[c],{type:'stock',id:c.id});assert.equal(s.stocks.length,1);applyCommand(s,[c],{type:'pin',id:c.id});assert.equal(s.pinned?.id,c.id);
 assert.equal(applyCommand(s,[c],{type:'profile',key:'youtube:alice',profile:{nickname:'',memo:'',muted:false,blocked:true}}).length,0);assert.equal(s.pinned,null);
});
test('OBS payload strips profiles, settings, user vote identities and disabled connections',()=>{
 const s=emptyStudio();s.poll=pollSchema.parse({title:'Q',options:['A','B'],active:true,votes:{'youtube:alice':1},correct:1});s.profiles['youtube:alice']={nickname:'A',memo:'PRIVATE',blocked:false,muted:false};s.pinned=comment('2','hidden');s.pinned.connectionId='hidden';
 const snapshot={settings:{theme:'dark',connections:[{id:'one',overlay:true},{id:'hidden',overlay:false}]},studio:s,comments:[comment('1','ok'),s.pinned],effects:[],listeners:{},statuses:{},update:'',overlayUrl:''} as unknown as Snapshot;
 const data=publicState(snapshot);assert.equal(data.comments.length,1);assert.equal(data.pinned,null);assert.equal(data.poll?.correct,-1);assert.deepEqual(data.poll?.counts,[0,1]);assert.ok(!JSON.stringify(data).includes('PRIVATE'));assert.ok(!('settings' in data));
});

