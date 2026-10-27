import { createReadStream } from 'node:fs';
import { appendFile,mkdir,readdir,readFile,writeFile,rename,stat,unlink } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import type { Comment } from '../shared/types';
import type { BackupInfo,LogQuery,LogResult } from '../shared/studio';
import { commentSchema } from '../shared/studio';

export class Archive {
 private pending=Promise.resolve();
 constructor(readonly root:string){}
 write(c:Comment){this.pending=this.pending.catch(()=>{}).then(async()=>{await mkdir(this.root,{recursive:true});await appendFile(path.join(this.root,`${c.timestamp.slice(0,10)}_${c.platform}.jsonl`),JSON.stringify(c)+'\n','utf8');});return this.pending;}
 flush(){return this.pending;}
 async importLegacy(){
  const files=await readdir(this.root).catch(()=>[]);const known=new Set(files);
  for(const name of files.filter(name=>/^\d{4}-\d{2}-\d{2}_(youtube|twitch|twitcasting)\.txt$/.test(name))){
   const target=name.replace(/\.txt$/,'.jsonl');if(known.has(target))continue;
   const platform=/(youtube|twitch|twitcasting)\.txt$/.exec(name)![1] as Comment['platform'];
   const stream=createReadStream(path.join(this.root,name),{encoding:'utf8'});const reader=createInterface({input:stream,crlfDelay:Infinity});let index=0;
   try{for await(const line of reader){const [timestamp,username,text,giftLabel]=line.split('\t');if(!timestamp||Number.isNaN(Date.parse(timestamp))||!username||text===undefined)continue;const c:Comment={id:`legacy:${createHash('sha256').update(`${name}:${index++}:${line}`).digest('hex')}`,connectionId:'legacy',platform,userId:`legacy:${username}`,username,text,timestamp:new Date(timestamp).toISOString(),emojis:[],gift:giftLabel?{kind:'superchat',label:giftLabel}:undefined};const valid=commentSchema.safeParse(c);if(valid.success)await this.write(valid.data);}}finally{reader.close();stream.destroy();}
  }
 }
 async search(query:LogQuery):Promise<LogResult>{
  await this.flush();const result:LogResult={comments:[],total:0,users:0,gifts:0,byPlatform:{},byHour:{},truncated:false};const users=new Set<string>();let lines=0;
  const files=await readdir(this.root).catch(()=>[]);
  outer:for(const name of files.filter(n=>/^\d{4}-\d{2}-\d{2}_(youtube|twitch|twitcasting)\.jsonl$/.test(n)).sort().reverse()){
   const day=name.slice(0,10);if(query.from&&day<query.from||query.to&&day>query.to||query.platform&& !name.endsWith(`_${query.platform}.jsonl`))continue;
   const stream=createReadStream(path.join(this.root,name),{encoding:'utf8'});const reader=createInterface({input:stream,crlfDelay:Infinity});
   try{for await(const line of reader){if(++lines>100000){result.truncated=true;break outer;}let c:Comment;try{c=commentSchema.parse(JSON.parse(line));}catch{continue;}
    if(query.query&&!`${c.username} ${c.nickname||''} ${c.text}`.toLowerCase().includes(query.query.toLowerCase()))continue;
    result.total++;users.add(`${c.platform}:${c.userId}`);if(c.gift)result.gifts++;result.byPlatform[c.platform]=(result.byPlatform[c.platform]||0)+1;const hour=c.timestamp.slice(0,13);result.byHour[hour]=(result.byHour[hour]||0)+1;
    // Files are scanned newest day first, so retain the newest 500 across all days.
    if(result.comments.length<500)result.comments.push(c);else{let oldest=0;for(let i=1;i<result.comments.length;i++)if(result.comments[i].timestamp<result.comments[oldest].timestamp)oldest=i;if(c.timestamp>result.comments[oldest].timestamp)result.comments[oldest]=c;}
   }}finally{reader.close();stream.destroy();}
  }result.users=users.size;result.comments.sort((a,b)=>b.timestamp.localeCompare(a.timestamp));return result;
 }
}
export class Backups {
 constructor(readonly root:string){}
 async list():Promise<BackupInfo[]>{await mkdir(this.root,{recursive:true});const list:BackupInfo[]=[];for(const name of await readdir(this.root)){if(!/^backup-[\w.-]+\.json$/.test(name))continue;const info=await stat(path.join(this.root,name));if(info.isFile())list.push({name,date:info.mtime.toISOString(),bytes:info.size});}return list.sort((a,b)=>b.date.localeCompare(a.date));}
 async create(data:unknown){await mkdir(this.root,{recursive:true});const name=`backup-${new Date().toISOString().replace(/[:]/g,'-')}-${randomUUID().slice(0,8)}.json`;const target=path.join(this.root,name);const temp=target+'.tmp';await writeFile(temp,JSON.stringify(data,null,2),'utf8');await rename(temp,target);return name;}
 async daily(data:unknown){const list=await this.list();if(!list.some(b=>b.date.slice(0,10)===new Date().toISOString().slice(0,10)))await this.create(data);const entries=await this.list();for(const old of entries.slice(30))await unlink(path.join(this.root,old.name));}
 async read(name:string){if(!/^backup-[\w.-]+\.json$/.test(name))throw Error('バックアップ名が不正です');const file=path.join(this.root,name);if((await stat(file)).size>20_000_000)throw Error('バックアップが大きすぎます');return JSON.parse(await readFile(file,'utf8')) as unknown;}
}
