import Store from 'electron-store';
import { mkdir,appendFile } from 'node:fs/promises';
import path from 'node:path';
import type { Comment,Listener,Settings } from '../shared/types';
import { emptyStudio,studioSchema,settingsSchema,type Studio } from '../shared/studio';
import { z } from 'zod';
import { recordListener } from '../shared/listener';
export const defaults:Settings={connections:[{id:'youtube',platform:'youtube',target:'',connect:false,tts:false,tracking:true,export:false},{id:'twitch',platform:'twitch',target:'',connect:false,tts:false,tracking:true,export:false}],theme:'dark',ngWords:[],filterMode:'mask',replacements:{www:'わらわら',URL:'ユーアールエル'},ttsEngine:'speech',speaker:0};
export class Repository {
 private store=new Store<{settings:Settings;listeners:Record<string,Listener>;studio:Studio}>({defaults:{settings:defaults,listeners:{},studio:emptyStudio()}});
 get studio(){return studioSchema.parse(this.store.get('studio'));} set studio(value:Studio){this.store.set('studio',value);}
 get settings(){return this.store.get('settings');} set settings(value:Settings){this.store.set('settings',value);}
 get listeners(){return this.store.get('listeners');}
 export(){return {version:1,settings:this.settings,listeners:this.listeners,studio:this.studio};}
 validate(input:unknown){const schema=z.object({version:z.literal(1),settings:settingsSchema,listeners:z.record(z.string(),z.object({firstSeen:z.string().datetime(),lastSeen:z.string().datetime(),username:z.string().max(300),count:z.number().int().nonnegative(),gifts:z.array(commentGift).max(100),giftCount:z.number().int().nonnegative().optional(),nameHistory:z.array(z.object({name:z.string().max(300),seenAt:z.string().datetime()})).max(20).optional(),giftTotals:z.record(z.string().max(30),z.number().nonnegative()).optional()})),studio:studioSchema});return schema.parse(input);}
 restore(input:unknown){const data=this.validate(input);this.store.store={settings:data.settings,listeners:data.listeners,studio:data.studio};}
 track(c:Comment){const db=this.listeners;const key=`${c.platform}:${c.userId}`;c.firstVisit=!db[key];db[key]=recordListener(db[key],c);this.store.set('listeners',db);}
}
const commentGift=z.object({kind:z.enum(['superchat','sticker','membership','bits','subscription','points']),label:z.string().max(1000),amount:z.number().optional(),currency:z.string().optional()});
export class LogWriter {
 private queue=Promise.resolve();
 constructor(private root:string){}
 write(c:Comment){const date=new Date(c.timestamp);const day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;const file=path.join(this.root,`${day}_${c.platform}.txt`);const clean=(s:string)=>s.replace(/[\r\n\t]/g,' ');this.queue=this.queue.catch(()=>{}).then(async()=>{await mkdir(this.root,{recursive:true});await appendFile(file,`${c.timestamp}\t${clean(c.username)}\t${clean(c.text)}\t${clean(c.gift?.label||'')}\n`,'utf8');});return this.queue;}
 flush(){return this.queue;}
}
