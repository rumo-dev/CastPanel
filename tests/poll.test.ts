import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudio,pollSchema,studioSchema,commandSchema } from '../src/shared/studio';
import { applyCommand,processStudio } from '../src/main/studio';
import { expirePoll,receiveVote,mergeAnswers,pollCounts,pollIsActive } from '../src/shared/poll';
import { publicState } from '../src/main/server';
import type { Snapshot } from '../src/shared/types';

function freePoll(){const studio=emptyStudio();applyCommand(studio,[],{type:'poll-create',title:'リクエスト',mode:'free',options:[],correct:-1});return studio.poll!;}
test('free answers require prefix and normalize width/case without increasing repeat votes',()=>{
 const poll=freePoll();receiveVote(poll,'youtube:a','普通のコメント');receiveVote(poll,'youtube:a','!投票 ＡＢＣ');receiveVote(poll,'youtube:b','!投票 abc');receiveVote(poll,'youtube:a','!投票 ABC');
 assert.deepEqual(pollCounts(poll),[2]);assert.equal(poll.options.length,1);receiveVote(poll,'youtube:a','!投票 別の回答');assert.deepEqual(pollCounts(poll),[1,1]);
});
test('answer merges remap indexes, preserve one vote per user and resolve chained aliases',()=>{
 const poll=freePoll();for(const [key,text] of [['a','ゲーム'],['b','game'],['c','ゲーム配信']])receiveVote(poll,`youtube:${key}`,`!投票 ${text}`);
 mergeAnswers(poll,0,2);assert.deepEqual(poll.options,['game','ゲーム配信']);assert.deepEqual(pollCounts(poll),[1,2]);
 mergeAnswers(poll,1,0);assert.deepEqual(poll.options,['game']);assert.deepEqual(pollCounts(poll),[3]);receiveVote(poll,'youtube:a','!投票 ゲーム');receiveVote(poll,'youtube:d','!投票 ゲーム配信');assert.deepEqual(pollCounts(poll),[4]);assert.equal(poll.options.length,1);
 assert.throws(()=>mergeAnswers(poll,0,0));
});
test('free answer text cannot resolve inherited object properties and is bounded',()=>{
 const poll=freePoll();for(const text of ['__proto__','constructor','toString'])receiveVote(poll,`youtube:${text}`,`!投票 ${text}`);assert.equal(poll.options.length,3);mergeAnswers(poll,0,1);receiveVote(poll,'youtube:other','!投票 __proto__');assert.equal(poll.options.length,2);
 for(let i=0;i<120;i++)receiveVote(poll,`youtube:${i}`,`!投票 answer${i}`);assert.equal(poll.options.length,100);receiveVote(poll,'youtube:long','!投票 '+'x'.repeat(101));assert.ok(!('youtube:long' in poll.votes));
});
test('deadline rejects exact-cutoff votes and expires without a comment',()=>{
 const poll=pollSchema.parse({title:'Q',options:['A','B'],correct:0,active:true,votes:{},closesAt:'2026-10-27T12:00:00.000Z'});const deadline=Date.parse(poll.closesAt!);
 receiveVote(poll,'youtube:a','1',deadline-1);receiveVote(poll,'youtube:b','2',deadline);assert.deepEqual(pollCounts(poll),[1,0]);assert.equal(pollIsActive(poll,deadline),false);
 const studio=emptyStudio();studio.poll=poll;assert.equal(expirePoll(studio,deadline),true);assert.equal(studio.poll.active,false);assert.equal(expirePoll(studio,deadline+1),false);
});
test('questions archive and reuse independently, reset votes and restart timer',()=>{
 const studio=emptyStudio();applyCommand(studio,[],{type:'poll-create',title:'First',options:['A','B'],correct:-1,durationSeconds:60});const first=studio.poll!;receiveVote(first,'youtube:a','1');applyCommand(studio,[],{type:'poll-create',title:'Second',mode:'free',options:[],correct:-1});assert.equal(studio.pollHistory.length,1);assert.equal(studio.pollHistory[0].active,false);
 applyCommand(studio,[],{type:'poll-reuse',id:first.id});assert.equal(studio.poll!.title,'First');assert.notEqual(studio.poll!.id,first.id);assert.deepEqual(studio.poll!.votes,{});assert.ok(Date.parse(studio.poll!.closesAt!)>Date.now());assert.equal(Object.keys(studio.pollHistory[0].votes).length,1);
 applyCommand(studio,[],{type:'poll-history-delete',id:first.id});assert.ok(!studio.pollHistory.some(p=>p.id===first.id));
});
test('old stored polls gain defaults and new fields survive backup serialization',()=>{
 const old=studioSchema.parse({poll:{title:'Q',options:['A','B'],active:true,votes:{'youtube:a':0},correct:-1}});assert.equal(old.poll!.mode,'choice');assert.equal(old.poll!.id,'legacy');assert.deepEqual(old.pollHistory,[]);
 const next=emptyStudio();next.poll=freePoll();receiveVote(next.poll,'youtube:a','!投票 A');next.poll.durationSeconds=60;assert.deepEqual(studioSchema.parse(JSON.parse(JSON.stringify(next))),next);
 assert.equal(commandSchema.safeParse({type:'poll-create',title:'Q',options:[],correct:-1}).success,false);assert.equal(commandSchema.safeParse({type:'poll-create',title:'Q',mode:'free',options:[],correct:-1,durationSeconds:-1}).success,false);
});
test('OBS exposes free-answer counts and deadline, never individual voters or aliases',()=>{
 const studio=emptyStudio();studio.poll=freePoll();receiveVote(studio.poll,'youtube:private','!投票 A');studio.poll.closesAt=new Date(Date.now()-1000).toISOString();
 const state={settings:{theme:'dark',connections:[]},studio,comments:[],effects:[]} as unknown as Snapshot;const output=publicState(state);assert.equal(output.poll!.active,false);assert.deepEqual(output.poll!.counts,[1]);assert.equal(output.poll!.mode,'free');assert.ok(!JSON.stringify(output).includes('youtube:private'));assert.ok(!('aliases' in output.poll!));
});
