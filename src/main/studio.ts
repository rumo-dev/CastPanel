import { addParticipant,leaveParticipant,queueAction,saveQueueUndo } from './participation';
import { randomInt,randomUUID } from 'node:crypto';
import type { Comment } from '../shared/types';
import type { Studio,StudioCommand,Effect } from '../shared/studio';
import { pollSchema } from '../shared/studio';
import { expirePoll,receiveVote,mergeAnswers } from '../shared/poll';

export const userKey=(c:Comment)=>`${c.platform}:${c.userId}`;
function move<T>(list:T[],index:number,delta:number){const next=index+delta;if(index<0||next<0||next>=list.length)return;[list[index],list[next]]=[list[next],list[index]];}
export function joinQueue(s:Studio,c:Comment,manual=true){const key=userKey(c);if(!s.profiles[key]?.blocked)addParticipant(s.participation,key,s.profiles[key]?.nickname||c.username,manual);}
export function processStudio(s:Studio,c:Comment,cooldowns:Map<string,number>,skipQueue=false):Effect[]{
 const key=userKey(c);c.nickname=s.profiles[key]?.nickname||undefined;
 if(!skipQueue){const p=s.participation;const matches=(word:string)=>word&&(p.config.match==='exact'?c.text.trim()===word:c.text.includes(word));if(matches(p.leaveWord))leaveParticipant(p,key);else if(p.enabled&&matches(p.joinWord))joinQueue(s,c,false);}
 expirePoll(s);if(s.poll)receiveVote(s.poll,key,c.text);
 const effects:Effect[]=[];
 for(const r of s.rules)if(r.enabled&&c.text.includes(r.word)&&Date.now()-(cooldowns.get(r.id)||0)>=r.cooldown*1000){cooldowns.set(r.id,Date.now());effects.push({id:randomUUID(),message:r.message.split('{name}').join(c.nickname||c.username).split('{comment}').join(c.text),timestamp:c.timestamp,hotkey:r.hotkey});}
 return effects;
}
export function applyCommand(s:Studio,comments:Comment[],command:StudioCommand):Comment[]{
 const find=(id:string)=>comments.find(c=>c.id===id)||s.stocks.find(c=>c.id===id);
 switch(command.type){
 case 'profile':s.profiles[command.key]={...s.profiles[command.key],...command.profile};if(command.profile.blocked){comments=comments.filter(c=>userKey(c)!==command.key);if(s.pinned&&userKey(s.pinned)===command.key)s.pinned=null;}break;
 case 'delete':comments=comments.filter(c=>c.id!==command.id);if(s.pinned?.id===command.id)s.pinned=null;break;
 case 'clear':comments=[];s.pinned=null;s.bookmarks=[];break;
 case 'pin':s.pinned=command.id?find(command.id)||null:null;break;
 case 'stock':{const c=find(command.id);if(c&&!s.stocks.some(x=>x.id===c.id)&&s.stocks.length<1000)s.stocks.push(c);break;}
 case 'unstock':s.stocks=s.stocks.filter(c=>c.id!==command.id);break;
 case 'bookmark':s.bookmarks=s.bookmarks.includes(command.id)?s.bookmarks.filter(id=>id!==command.id):[...s.bookmarks,command.id].slice(-1000);break;
 case 'participation':Object.assign(s.participation,{enabled:command.enabled,joinWord:command.joinWord,leaveWord:command.leaveWord});break;
 case 'queue-accept':s.participation.enabled=command.enabled;break;
 case 'queue-config':s.participation.config=command.config;break;
 case 'queue-appearance':s.participation.appearance=command.appearance;break;
 case 'queue-add':{const key=command.platform+':'+command.userId;if(s.profiles[key]?.blocked)throw Error('ブロックされているリスナーです');addParticipant(s.participation,key,command.name,true);break;}
 case 'queue-action':queueAction(s.participation,command.action,command.key);break;
 case 'join':{const c=find(command.id);if(c)joinQueue(s,c);break;}
 case 'queue':{const p=s.participation,index=p.queue.findIndex(e=>e.key===command.key);if(index<0)break;saveQueueUndo(p);if(command.action==='done'||command.action==='remove')leaveParticipant(p,command.key,command.action==='done');else move(p.queue,index,command.action==='up'?-1:1);break;}
 case 'shuffle':{const p=s.participation;saveQueueUndo(p);const list=p.queue;for(let i=list.length-1;i>0;i--){const j=randomInt(i+1);[list[i],list[j]]=[list[j],list[i]];}break;}
 case 'least-played':saveQueueUndo(s.participation);s.participation.queue.sort((a,b)=>(s.participation.history[a.key]||0)-(s.participation.history[b.key]||0));break;
 case 'poll-create':{
  const mode=command.mode||'choice';if(mode==='choice'&&command.correct>=command.options.length)throw Error('正解の選択肢が範囲外です');
  if(s.poll)s.pollHistory=[...s.pollHistory,{...s.poll,active:false}].slice(-30);
  const duration=command.durationSeconds||0;
  s.poll=pollSchema.parse({id:randomUUID(),title:command.title,mode,options:mode==='free'?[]:command.options,correct:mode==='free'?-1:command.correct,active:true,votes:{},answerPrefix:command.answerPrefix??(mode==='free'?'!投票':''),durationSeconds:duration,closesAt:duration?new Date(Date.now()+duration*1000).toISOString():null});break;
 }
 case 'poll-toggle':if(s.poll){s.poll.active=command.active;s.poll.endedAt=command.active?null:new Date().toISOString();s.poll.closesAt=command.active&&s.poll.durationSeconds?new Date(Date.now()+s.poll.durationSeconds*1000).toISOString():null;}break;
 case 'poll-merge':if(s.poll)mergeAnswers(s.poll,command.source,command.target);break;
 case 'poll-reuse':{const old=s.pollHistory.find(p=>p.id===command.id);if(!old)throw Error('質問が見つかりません');const next=pollSchema.parse({...old,id:randomUUID(),active:true,endedAt:null,votes:{},options:old.mode==='free'?[]:old.options,aliases:{},closesAt:old.durationSeconds?new Date(Date.now()+old.durationSeconds*1000).toISOString():null});if(s.poll)s.pollHistory=[...s.pollHistory,{...s.poll,active:false}].slice(-30);s.poll=next;break;}
 case 'poll-history-delete':s.pollHistory=s.pollHistory.filter(p=>p.id!==command.id);break;
 case 'rules':s.rules=command.rules;break;
 case 'effect':break;
 case 'setlist-add':if(s.setlist.length<500)s.setlist.push({id:randomUUID(),title:command.title,artist:command.artist,done:false});break;
 case 'setlist-update':{const index=s.setlist.findIndex(v=>v.id===command.id);if(index<0)break;if(command.action==='remove')s.setlist.splice(index,1);else if(command.action==='done')s.setlist[index].done=!s.setlist[index].done;else move(s.setlist,index,command.action==='up'?-1:1);break;}
 case 'setlist-edit':{const song=s.setlist.find(song=>song.id===command.id);if(song)Object.assign(song,{title:command.title,artist:command.artist});break;}
 case 'stream-start':s.streamStartedAt=new Date().toISOString();break;
 case 'stream-time':if(Date.parse(command.startedAt)>Date.now())throw Error('配信開始時刻は未来に設定できません');s.streamStartedAt=command.startedAt;break;
 case 'timestamp-edit':{const stamp=s.timestamps.find(t=>t.id===command.id);if(stamp)Object.assign(stamp,{label:command.label,seconds:command.seconds});s.timestamps.sort((a,b)=>a.seconds-b.seconds);break;}
 case 'timestamp-remove':s.timestamps=s.timestamps.filter(t=>t.id!==command.id);break;
 case 'timestamp':{if(!s.streamStartedAt)throw Error('先に配信開始時刻を設定してください');if(s.timestamps.length<1000)s.timestamps.push({id:randomUUID(),seconds:Math.max(0,Math.floor((Date.now()-Date.parse(s.streamStartedAt))/1000)),label:command.label});break;}
 case 'overlay':s.overlay=command.overlay;break;
 case 'split':s.split=command.value;break;
 case 'translation-config':s.translation={enabled:command.enabled,target:command.target};break;
 case 'translate':break;
 case 'plugin-add':if(s.plugins.length>=30)throw Error('プラグインは最大30件です');s.plugins.push({id:randomUUID(),name:command.name,endpoint:command.endpoint,enabled:false});break;
 case 'plugin-toggle':{const plugin=s.plugins.find(p=>p.id===command.id);if(plugin)plugin.enabled=command.enabled;break;}
 case 'plugin-remove':s.plugins=s.plugins.filter(p=>p.id!==command.id);break;
 }
 return comments;
}





