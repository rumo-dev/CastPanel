import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import type { Comment } from '../shared/types';
import type { Studio } from '../shared/studio';

export interface ITranslationEngine {translate(text:string,target:string):Promise<string>}
export class LibreTranslate implements ITranslationEngine {
 constructor(private base='http://127.0.0.1:5000'){}
 async translate(text:string,target:string){const response=await fetch(this.base+'/translate',{method:'POST',headers:{'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(8000),body:JSON.stringify({q:text.slice(0,5000),source:'auto',target,format:'text'})});if(!response.ok)throw Error(`翻訳サーバー HTTP ${response.status}`);const body=await response.json() as {translatedText?:unknown};if(typeof body.translatedText!=='string')throw Error('翻訳結果が不正です');return body.translatedText.slice(0,10000);}
}
export class PluginDispatcher {
 private active=0;
 dispatch(comment:Comment,plugins:Studio['plugins'],onError:(id:string,e:unknown)=>void){for(const plugin of plugins.filter(p=>p.enabled)){if(this.active>=8){onError(plugin.id,'プラグイン処理が混雑しています');continue;}this.active++;void fetch(plugin.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'comment',version:1,comment}),redirect:'error',signal:AbortSignal.timeout(2000)}).then(async response=>{await response.body?.cancel();if(!response.ok)throw Error(`HTTP ${response.status}`);}).catch(e=>onError(plugin.id,e)).finally(()=>this.active--);}}
}
export class VTubeStudio {
 constructor(private endpoint='ws://127.0.0.1:8001'){}
 private socket?:WebSocket;
 private pending=new Map<string,{resolve:(data:Record<string,unknown>)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 private authenticated=false;
 async connect(token?:string){
  this.disconnect();const socket=this.socket=new WebSocket(this.endpoint,{maxPayload:1_000_000});
  socket.on('message',data=>{try{const message=JSON.parse(data.toString());const item=this.pending.get(message.requestID);if(!item)return;clearTimeout(item.timer);this.pending.delete(message.requestID);if(message.messageType==='APIError')item.reject(Error(`VTube Studio: ${message.data?.message||'API error'}`));else item.resolve(message.data||{});}catch{}});
  socket.on('error',()=>{});socket.on('close',()=>{if(this.socket!==socket)return;this.authenticated=false;for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(Error('VTube Studioとの接続が切れました'));}this.pending.clear();});
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{socket.terminate();reject(Error('VTube Studio接続タイムアウト'));},5000);socket.once('open',()=>{clearTimeout(timer);resolve();});socket.once('error',error=>{clearTimeout(timer);reject(error);});});
  if(!token){const response=await this.request('AuthenticationTokenRequest',{pluginName:'CastPanel',pluginDeveloper:'CastPanel'});if(typeof response.authenticationToken!=='string')throw Error('VTube Studioで接続を許可してください');token=response.authenticationToken;}
  const response=await this.request('AuthenticationRequest',{pluginName:'CastPanel',pluginDeveloper:'CastPanel',authenticationToken:token});
  if(response.authenticated!==true)throw Error('VTube Studioの認証が拒否されました');this.authenticated=true;return token;
 }
 private request(type:string,data:Record<string,unknown>){return new Promise<Record<string,unknown>>((resolve,reject)=>{if(this.socket?.readyState!==WebSocket.OPEN){reject(Error('VTube Studioが未接続です'));return;}const id=randomUUID();const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('VTube Studio応答タイムアウト'));},60000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({apiName:'VTubeStudioPublicAPI',apiVersion:'1.0',requestID:id,messageType:type,data}));});}
 async trigger(hotkey:string){if(!this.authenticated)throw Error('VTube Studioを先に接続してください');await this.request('HotkeyTriggerRequest',{hotkeyID:hotkey});}
 disconnect(){this.authenticated=false;this.socket?.terminate();this.socket=undefined;for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(Error('VTube Studio接続を停止しました'));}this.pending.clear();}
}
