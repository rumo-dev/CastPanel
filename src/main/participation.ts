import { randomInt } from 'node:crypto';
import { participationSchema,type Participation,type QueueAction } from '../shared/participation';
function event(p:Participation,kind:string,name:string,note='',now=Date.now()){p.events.push({at:new Date(now).toISOString(),kind,name,note});p.events=p.events.slice(-200);p.notice=[name,note||kind].filter(Boolean).join('：');}
function stat(p:Participation,key:string,name:string,now:number){return p.stats[key]??=( {name,joins:0,plays:0,rounds:0,lastAt:new Date(now).toISOString(),lastLeaveAt:''});}
export function saveQueueUndo(p:Participation){p.undo.push(JSON.stringify({queue:p.queue,stats:p.stats,history:p.history,blacklist:p.blacklist}));p.undo=p.undo.slice(-30);}
export function addParticipant(p:Participation,key:string,name:string,manual=false,now=Date.now()):boolean{
 if(p.queue.some(e=>e.key===key)){p.notice=name+'さんはすでに登録されています';return false;}
 let reason='';
 if(Object.hasOwn(p.blacklist,key))reason='参加ブラックリストに登録されています';
 else if(!manual&&!p.enabled)return false;
 else if(p.queue.length>=1000||p.config.maxQueue&&p.queue.length>=p.config.maxQueue)reason='参加人数の上限です';
 else {const left=p.stats[key]?.lastLeaveAt;if(!manual&&left&&now-Date.parse(left)<p.config.cooldownMinutes*60000)reason='再参加の待ち時間中です';}
 if(reason){const last=p.events.at(-1);if(!last||last.name!==name||last.note!==reason||now-Date.parse(last.at)>30000)event(p,'拒否',name,reason,now);return false;}
 p.queue.push({key,name,joinedAt:new Date(now).toISOString(),count:p.history[key]||0,plays:0,team:''});const s=stat(p,key,name,now);s.name=name;s.joins++;s.lastAt=new Date(now).toISOString();event(p,'参加',name,manual?'手動追加':'コメント参加',now);return true;
}
export function leaveParticipant(p:Participation,key:string,completed=false,now=Date.now()){const e=p.queue.find(e=>e.key===key);if(!e)return;const s=stat(p,key,e.name,now);s.lastLeaveAt=new Date(now).toISOString();if(completed){p.history[key]=(p.history[key]||0)+1;s.rounds++;}p.queue=p.queue.filter(e=>e.key!==key);event(p,completed?'参加完了':'退出',e.name,'',now);}
export function queueAction(p:Participation,action:QueueAction,key?:string,now=Date.now()){
 if(action==='undo'){
  const raw=p.undo.at(-1);if(!raw){p.notice='取り消せる操作はありません';return;}
  const previous=participationSchema.parse({...JSON.parse(raw)});const keys=new Set(previous.queue.map(e=>e.key));
  // 操作後にコメントで参加した人は取り消しで消さない。
  const extra=p.queue.filter(e=>!keys.has(e.key));
  const extraStats=Object.fromEntries(extra.map(e=>[e.key,p.stats[e.key]]));
  p.undo.pop();p.queue=[...previous.queue,...extra].slice(0,1000);p.stats={...previous.stats,...extraStats};p.history=previous.history;p.blacklist=previous.blacklist;event(p,'取り消し','','直前の操作を元に戻しました',now);return;
 }
 const before=JSON.stringify({queue:p.queue,stats:p.stats,history:p.history,blacklist:p.blacklist});
 const active=p.queue.slice(0,p.config.slots);const selected=p.queue.find(e=>e.key===key);
 const plus=(e:Participation['queue'][number])=>{e.plays++;stat(p,e.key,e.name,now).plays++;};
 const swap=(e:Participation['queue'][number])=>{p.history[e.key]=(p.history[e.key]||0)+1;stat(p,e.key,e.name,now).rounds++;p.queue=p.queue.filter(u=>u.key!==e.key);e.plays=0;e.count=p.history[e.key];p.queue.push(e);};
 switch(action){
  case 'plus':if(selected)plus(selected);break;
  case 'plus-all':active.forEach(plus);break;
  case 'swap':if(selected)swap(selected);break;
  case 'swap-first':if(active[0])swap(active[0]);break;
  case 'swap-limit':active.filter(e=>e.plays>=p.config.limit).forEach(swap);break;
  case 'remove-limit':active.filter(e=>e.plays>=p.config.limit).forEach(e=>leaveParticipant(p,e.key,true,now));break;
  case 'clear':[...p.queue].forEach(e=>leaveParticipant(p,e.key,false,now));break;
  case 'reset-count':if(selected)selected.plays=0;break;
  case 'block':if(key){const name=selected?.name||p.stats[key]?.name||key;if(Object.keys(p.blacklist).length>=1000&&!Object.hasOwn(p.blacklist,key))throw Error('ブラックリストは最大1000人です');p.blacklist[key]=name;leaveParticipant(p,key,false,now);}break;
  case 'unblock':if(key)delete p.blacklist[key];break;
  case 'teams':{const list=[...p.queue];for(let i=list.length-1;i>0;i--){const j=randomInt(i+1);[list[i],list[j]]=[list[j],list[i]];}list.forEach((e,i)=>{e.team='チーム'+(i%p.config.teams+1);});break;}
 }
 if(before!==JSON.stringify({queue:p.queue,stats:p.stats,history:p.history,blacklist:p.blacklist})){p.undo.push(before);p.undo=p.undo.slice(-30);const labels:Record<QueueAction,string>={'plus':'回数＋1','plus-all':'全員＋1','swap':'交代','swap-first':'先頭を交代','swap-limit':'上限者を交代','remove-limit':'上限者を完了','clear':'全員退出','undo':'取り消し','block':'参加禁止','unblock':'参加禁止を解除','teams':'チーム分け','reset-count':'連続回数をリセット'};event(p,'操作',selected?.name||'',labels[action],now);}
}



