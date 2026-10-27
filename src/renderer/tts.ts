import type { Settings } from '../shared/types';
import { speechText } from '../shared/filter';
import { resolveSpeech,type SpeechConfig } from '../shared/speech';
export interface ITTSEngine { speak(text:string,signal:AbortSignal):Promise<void>; stop():void }
function aborted(signal:AbortSignal){if(signal.aborted)throw new DOMException('Cancelled','AbortError');}
export class SpeechEngine implements ITTSEngine {
 constructor(private rate=1,private volume=1,private voiceURI=''){}
 speak(text:string,signal:AbortSignal){aborted(signal);return new Promise<void>((resolve,reject)=>{
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='ja-JP';utterance.rate=this.rate;utterance.volume=this.volume;
  if(this.voiceURI){const voice=speechSynthesis.getVoices().find(voice=>voice.voiceURI===this.voiceURI);if(voice){utterance.voice=voice;utterance.lang=voice.lang;}}
  const cancel=()=>{speechSynthesis.cancel();resolve();};const done=()=>signal.removeEventListener('abort',cancel);
  utterance.onend=()=>{done();resolve();};utterance.onerror=()=>{done();reject(Error('音声読み上げ失敗'));};signal.addEventListener('abort',cancel,{once:true});speechSynthesis.speak(utterance);
 });}
 stop(){speechSynthesis.cancel();}
}
export class LocalAudioEngine implements ITTSEngine {
 private audio?:HTMLAudioElement;
 constructor(private settings:SpeechConfig){}
 async speak(text:string,signal:AbortSignal){
  aborted(signal);const s=this.settings;let response:Response;
  if(s.ttsEngine==='coeiroink'){
   if(!s.coeiroSpeaker)throw Error('COEIROINK speaker UUIDを設定してください');
   response=await fetch('http://127.0.0.1:50032/v1/synthesis',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({speakerUuid:s.coeiroSpeaker,styleId:s.speaker,text,speedScale:1,volumeScale:1,pitchScale:0,intonationScale:1,prePhonemeLength:0,postPhonemeLength:0,outputSamplingRate:44100,sampledIntervalValue:0,adjustedF0:[],processingAlgorithm:'coeiroink',prosodyDetail:[]})});
  }else{
   const base=s.ttsEngine==='aivis'?'http://127.0.0.1:10101':'http://127.0.0.1:50021';
   const query=await fetch(`${base}/audio_query?text=${encodeURIComponent(text)}&speaker=${s.speaker}`,{method:'POST',signal});
   if(!query.ok)throw Error(`${s.ttsEngine}: audio_query HTTP ${query.status}`);
   response=await fetch(`${base}/synthesis?speaker=${s.speaker}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(await query.json()),signal});
  }
  if(!response.ok)throw Error(`${s.ttsEngine}: synthesis HTTP ${response.status}`);
  const blob=await response.blob();aborted(signal);const url=URL.createObjectURL(blob);
  try{await new Promise<void>((resolve,reject)=>{
   const audio=this.audio=new Audio(url);audio.volume=s.speechVolume??1;audio.playbackRate=s.speechRate??1;
   const cancel=()=>{audio.pause();resolve();};const done=()=>signal.removeEventListener('abort',cancel);
   audio.onended=()=>{done();resolve();};audio.onerror=()=>{done();reject(Error('音声再生失敗'));};signal.addEventListener('abort',cancel,{once:true});void audio.play().catch(error=>{done();reject(error);});
  });}finally{URL.revokeObjectURL(url);}
 }
 stop(){this.audio?.pause();}
}
export type EngineFactory=(config:SpeechConfig)=>ITTSEngine;
export const createEngine:EngineFactory=config=>config.ttsEngine==='speech'?new SpeechEngine(config.speechRate,config.speechVolume,config.voiceURI):config.ttsEngine==='bouyomi'?{speak:async(text,signal)=>{aborted(signal);await window.castpanel.bouyomi(text);},stop(){}}:config.ttsEngine==='voicepeak'?{speak:async()=>{throw Error('VOICEPEAKブリッジ未設定');},stop(){}}:new LocalAudioEngine(config);
interface SpeechItem {rawText:string;name:string;connectionId:string;userKey:string;config:SpeechConfig;replacements:Record<string,string>;sequence:number}
export class TTSManager {
 private queue:SpeechItem[]=[];
 private currentItem?:{connectionId:string;userKey:string};
 private running=false;
 private current?:AbortController;
 private engine?:ITTSEngine;
 private key='';
 private sequence=0;
 constructor(private onError:(message:string)=>void=console.warn,private factory:EngineFactory=createEngine){}
 configure(settings:Settings){
  const key=JSON.stringify([settings.ttsEngine,settings.speaker,settings.speechRate,settings.speechVolume,settings.coeiroSpeaker,settings.voiceURI,settings.readName,settings.speechFallback,settings.replacements,settings.connections.map(c=>[c.id,c.speech])]);if(key===this.key)return;this.key=key;
  for(const item of this.queue){item.config=resolveSpeech(settings,item.connectionId);item.replacements=settings.replacements;}this.sortQueue();
 }
 setEligibility(allowed:(connectionId:string,userKey:string)=>boolean){this.queue=this.queue.filter(item=>allowed(item.connectionId,item.userKey));if(this.currentItem&&!allowed(this.currentItem.connectionId,this.currentItem.userKey))this.current?.abort();}
 enqueue(text:string,settings:Settings,connectionId:string,userKey:string,name=''){this.configure(settings);this.queue.push({rawText:text,name,connectionId,userKey,config:resolveSpeech(settings,connectionId),replacements:settings.replacements,sequence:this.sequence++});this.sortQueue();if(this.queue.length>30)this.queue.pop();void this.drain();}
 private sortQueue(){this.queue.sort((a,b)=>b.config.priority-a.config.priority||a.sequence-b.sequence);}
 private async drain(){
  if(this.running)return;this.running=true;
  try{while(this.queue.length){
   const item=this.queue.shift()!;this.currentItem=item;const controller=this.current=new AbortController();
   const text=speechText((item.config.readName&&item.name?`${item.name}さん、`:'')+item.rawText,item.replacements);
   const timer=setTimeout(()=>controller.abort(),20000);
   try{this.engine=this.factory(item.config);await this.engine.speak(text,controller.signal);}catch(error){if(!controller.signal.aborted){this.onError(String(error));if(item.config.fallback&&item.config.ttsEngine!=='speech'){try{this.engine=this.factory({...item.config,ttsEngine:'speech'});await this.engine.speak(text,controller.signal);}catch(fallbackError){if(!controller.signal.aborted)this.onError(String(fallbackError));}}}}finally{clearTimeout(timer);if(this.current===controller){this.current=undefined;this.currentItem=undefined;this.engine=undefined;}}
  }}finally{this.running=false;}
 }
 stop(){this.queue=[];this.current?.abort();this.engine?.stop();}
}
