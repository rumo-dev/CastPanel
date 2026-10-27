import Store from 'electron-store';
import { mkdir,appendFile } from 'node:fs/promises';
import path from 'node:path';
import type { Comment,Listener,Settings } from '../shared/types';
export const defaults:Settings={connections:[{id:'youtube',platform:'youtube',target:'',connect:false,tts:false,tracking:true,export:false},{id:'twitch',platform:'twitch',target:'',connect:false,tts:false,tracking:true,export:false}],theme:'dark',ngWords:[],filterMode:'mask',replacements:{www:'わらわら',URL:'ユーアールエル'},ttsEngine:'speech',speaker:0};
export class Repository {
 private store=new Store<{settings:Settings;listeners:Record<string,Listener>}>({defaults:{settings:defaults,listeners:{}}});
 get settings(){return this.store.get('settings');} set settings(value:Settings){this.store.set('settings',value);}
 get listeners(){return this.store.get('listeners');}
 track(c:Comment){const db=this.listeners;const key=`${c.platform}:${c.userId}`;const old=db[key];c.firstVisit=!old;db[key]={firstSeen:old?.firstSeen||c.timestamp,lastSeen:c.timestamp,username:c.username,count:(old?.count||0)+1,gifts:[...(old?.gifts||[]),...(c.gift?[c.gift]:[])].slice(-100)};this.store.set('listeners',db);}
}
export class LogWriter {
 private queue=Promise.resolve();
 constructor(private root:string){}
 write(c:Comment){const date=new Date(c.timestamp);const day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;const file=path.join(this.root,`${day}_${c.platform}.txt`);const clean=(s:string)=>s.replace(/[\r\n\t]/g,' ');this.queue=this.queue.catch(()=>{}).then(async()=>{await mkdir(this.root,{recursive:true});await appendFile(file,`${c.timestamp}\t${clean(c.username)}\t${clean(c.text)}\t${clean(c.gift?.label||'')}\n`,'utf8');});return this.queue;}
 flush(){return this.queue;}
}
