import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Settings } from '../src/shared/types';
import { resolveSpeech } from '../src/shared/speech';
import { settingsSchema } from '../src/shared/studio';
import { TTSManager,type EngineFactory } from '../src/renderer/tts';
const settings=():Settings=>({connections:[{id:'a',platform:'youtube',target:'',connect:false,tts:true,tracking:true,export:false},{id:'b',platform:'twitch',target:'',connect:false,tts:true,tracking:true,export:false}],theme:'dark',ngWords:[],filterMode:'hide',replacements:{www:'わら'},ttsEngine:'speech',speaker:3,speechRate:1.2,speechVolume:0.8,readName:true});
const delay=()=>new Promise(resolve=>setTimeout(resolve,0));
test('per-connection speech inherits defaults and preserves explicit zero/false values',()=>{
 const s=settings();s.connections[0].speech={enabled:true,engine:'voicevox',speaker:0,volume:0,readName:false,priority:4};const a=resolveSpeech(s,'a');assert.equal(a.ttsEngine,'voicevox');assert.equal(a.speaker,0);assert.equal(a.speechVolume,0);assert.equal(a.readName,false);assert.equal(a.speechRate,1.2);assert.equal(resolveSpeech(s,'b').ttsEngine,'speech');s.connections[0].speech.enabled=false;assert.equal(resolveSpeech(s,'a').speaker,3);
 assert.equal(settingsSchema.safeParse({...s,connections:[{...s.connections[0],speech:{enabled:true,rate:9}}]}).success,false);
});
test('speech queue is non-preemptive, prioritizes waiting items and keeps equal-priority order',async()=>{
 const s=settings();s.connections[1].speech={enabled:true,priority:5,readName:false};const spoken:string[]=[];let release:()=>void=()=>{};
 const factory:EngineFactory=()=>({speak:async text=>{spoken.push(text);if(spoken.length===1)await new Promise<void>(resolve=>release=resolve);},stop(){release();}});
 const manager=new TTSManager(assert.fail,factory);manager.enqueue('first',s,'a','youtube:a','Alice');manager.enqueue('normal',s,'a','youtube:a','Alice');manager.enqueue('high1',s,'b','twitch:b','Bob');manager.enqueue('high2',s,'b','twitch:b','Bob');assert.deepEqual(spoken,['Aliceさん、first']);release();await delay();assert.deepEqual(spoken,['Aliceさん、first','high1','high2','Aliceさん、normal']);manager.stop();
});
test('unavailable engine falls back, while disabled fallback skips speech',async()=>{
 const s=settings();s.ttsEngine='voicevox';const calls:string[]=[];const errors:string[]=[];const factory:EngineFactory=config=>({speak:async()=>{calls.push(config.ttsEngine);if(config.ttsEngine==='voicevox')throw Error('offline');},stop(){}});const manager=new TTSManager(message=>errors.push(message),factory);manager.enqueue('test',s,'a','youtube:a');await delay();assert.deepEqual(calls,['voicevox','speech']);assert.equal(errors.length,1);calls.length=0;s.speechFallback=false;manager.enqueue('test',s,'a','youtube:a');await delay();assert.deepEqual(calls,['voicevox']);manager.stop();
});
test('muting/disabling removes queued items and aborts an in-progress item',async()=>{
 const s=settings();const spoken:string[]=[];let aborted=false;const manager=new TTSManager(assert.fail,()=>({speak:async(text,signal)=>{spoken.push(text);await new Promise<void>(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true}));},stop(){}}));manager.enqueue('first',s,'a','youtube:a');manager.enqueue('second',s,'a','youtube:a');manager.setEligibility(()=>false);await delay();assert.equal(aborted,true);assert.deepEqual(spoken,['first']);manager.stop();
});
test('configuration changes update waiting speech without cutting off the current item',async()=>{
 const s=settings();const spoken:string[]=[];const volumes:number[]=[];let release:()=>void=()=>{};let interrupted=false;
 const manager=new TTSManager(assert.fail,config=>({speak:async(text,signal)=>{spoken.push(text);volumes.push(config.speechVolume);signal.addEventListener('abort',()=>{interrupted=true;},{once:true});if(spoken.length===1)await new Promise<void>(resolve=>release=resolve);},stop(){release();}}));
 manager.enqueue('first',s,'a','youtube:a','Alice');manager.enqueue('www',s,'a','youtube:a','Alice');const changed={...s,speechVolume:0.3,readName:false,replacements:{www:'新しい辞書'}};manager.configure(changed);assert.equal(interrupted,false);release();await delay();assert.deepEqual(spoken,['Aliceさん、first','新しい辞書']);assert.deepEqual(volumes,[0.8,0.3]);manager.stop();
});
