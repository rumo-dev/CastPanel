import type { Settings } from '../shared/types';
import { speechText } from '../shared/filter';
export interface ITTSEngine { speak(text:string,signal:AbortSignal):Promise<void>; stop():void }
export class SpeechEngine implements ITTSEngine {
 speak(text:string,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{const u=new SpeechSynthesisUtterance(text);u.lang='ja-JP';u.onend=()=>resolve();u.onerror=()=>reject(Error('音声読み上げ失敗'));signal.addEventListener('abort',()=>{speechSynthesis.cancel();resolve();},{once:true});speechSynthesis.speak(u);});}stop(){speechSynthesis.cancel();}
}
export class VoicevoxEngine implements ITTSEngine {
 private audio?:HTMLAudioElement;
 constructor(private speaker:number){}
 async speak(text:string,signal:AbortSignal){const base='http://127.0.0.1:50021';const query=await fetch(`${base}/audio_query?text=${encodeURIComponent(text)}&speaker=${this.speaker}`,{method:'POST',signal});if(!query.ok)throw Error('VOICEVOX audio_query失敗');const response=await fetch(`${base}/synthesis?speaker=${this.speaker}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(await query.json()),signal});if(!response.ok)throw Error('VOICEVOX synthesis失敗');const url=URL.createObjectURL(await response.blob());try{await new Promise<void>((resolve,reject)=>{const a=this.audio=new Audio(url);a.onended=()=>resolve();a.onerror=()=>reject(Error('音声再生失敗'));signal.addEventListener('abort',()=>{a.pause();resolve();},{once:true});void a.play().catch(reject);});}finally{URL.revokeObjectURL(url);}}
 stop(){this.audio?.pause();}
}
// VOICEPEAK does not implement the VOICEVOX HTTP API. Register a licensed bridge implementation here.
export class TTSManager {
 private queue:string[]=[];private running=false;private abort=new AbortController();private engine:ITTSEngine=new SpeechEngine();private key='';
 configure(s:Settings){const key=`${s.ttsEngine}:${s.speaker}`;if(key===this.key)return;this.stop();this.key=key;this.engine=s.ttsEngine==='voicevox'?new VoicevoxEngine(s.speaker):s.ttsEngine==='speech'?new SpeechEngine():{speak:async()=>{throw Error('VOICEPEAKブリッジ未設定');},stop(){}};}
 enqueue(text:string,s:Settings){this.queue.push(speechText(text,s.replacements));if(this.queue.length>30)this.queue.shift();void this.drain();}
 private async drain(){if(this.running)return;this.running=true;try{while(this.queue.length){const text=this.queue.shift()!;const signal=this.abort.signal;const timer=setTimeout(()=>this.abort.abort(),20000);try{await this.engine.speak(text,signal);}catch(e){console.warn(e);}finally{clearTimeout(timer);if(this.abort.signal.aborted)this.abort=new AbortController();}}}finally{this.running=false;}}
 stop(){this.queue=[];this.abort.abort();this.abort=new AbortController();this.engine.stop();}
}
