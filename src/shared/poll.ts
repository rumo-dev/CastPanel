import type { Studio } from './studio';
export type Poll=NonNullable<Studio['poll']>;
export const normalizeAnswer=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ja');
export function pollIsActive(poll:Poll,now=Date.now()){return poll.active&&(!poll.closesAt||Date.parse(poll.closesAt)>now);}
export function pollCounts(poll:Poll){const counts=poll.options.map(()=>0);for(const vote of Object.values(poll.votes))if(vote>=0&&vote<counts.length)counts[vote]++;return counts;}
export function expirePoll(studio:Studio,now=Date.now()){
 if(studio.poll?.active&&studio.poll.closesAt&&Date.parse(studio.poll.closesAt)<=now){studio.poll.active=false;studio.poll.endedAt=studio.poll.closesAt;return true;}return false;
}
export function receiveVote(poll:Poll,userKey:string,text:string,now=Date.now()){
 if(!pollIsActive(poll,now))return;
 text=text.trim();
 if(poll.answerPrefix){if(!text.startsWith(poll.answerPrefix))return;text=text.slice(poll.answerPrefix.length).trim();}
 if(!text||text.length>100)return;
 let index:number;
 if(poll.mode==='free'){
  const normalized=normalizeAnswer(text);const alias=poll.aliases[`answer:${normalized}`];
  index=poll.options.findIndex(option=>normalizeAnswer(option)===normalizeAnswer(alias||text));
  if(index<0){if(poll.options.length>=100)return;index=poll.options.push(text)-1;}
 }else{
  index=/^\d+$/.test(text)?Number(text)-1:poll.options.findIndex(option=>normalizeAnswer(option)===normalizeAnswer(text));
 }
 if(index>=0&&index<poll.options.length)poll.votes[userKey]=index;
}
export function mergeAnswers(poll:Poll,source:number,target:number){
 if(poll.mode!=='free')throw Error('表記ゆれ統合は自由回答で利用できます');
 if(source===target||source>=poll.options.length||target>=poll.options.length)throw Error('異なる2つの回答を選択してください');
 const old=poll.options[source],canonical=poll.options[target];
 // Resolve existing aliases as well, so chained merges keep future answers together.
 for(const [key,value] of Object.entries(poll.aliases))if(normalizeAnswer(value)===normalizeAnswer(old))poll.aliases[key]=canonical;
 poll.aliases[`answer:${normalizeAnswer(old)}`]=canonical;
 for(const key of Object.keys(poll.votes)){let index=poll.votes[key];if(index===source)index=target;poll.votes[key]=index>source?index-1:index;}
 poll.options.splice(source,1);
}
export function formatTimestamp(seconds:number){const whole=Math.max(0,Math.floor(seconds));return `${String(Math.floor(whole/3600)).padStart(2,'0')}:${String(Math.floor(whole/60)%60).padStart(2,'0')}:${String(whole%60).padStart(2,'0')}`;}

