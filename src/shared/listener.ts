import type { Comment,Listener } from './types';
export function recordListener(previous:Listener|undefined,comment:Comment):Listener{
 const history=[...(previous?.nameHistory||[])];
 if(!history.length&&previous)history.push({name:previous.username,seenAt:previous.lastSeen||previous.firstSeen});
 if(history.at(-1)?.name!==comment.username)history.push({name:comment.username,seenAt:comment.timestamp});
 const totals={...(previous?.giftTotals||{})};
 if(!previous?.giftTotals)for(const gift of previous?.gifts||[])if(gift.currency&&gift.amount)totals[gift.currency]=(totals[gift.currency]||0)+gift.amount;
 if(comment.gift?.currency&&comment.gift.amount)totals[comment.gift.currency]=(totals[comment.gift.currency]||0)+comment.gift.amount;
 return {firstSeen:previous?.firstSeen||comment.timestamp,lastSeen:comment.timestamp,username:comment.username,count:(previous?.count||0)+1,gifts:[...(previous?.gifts||[]),...(comment.gift?[comment.gift]:[])].slice(-100),giftCount:(previous?.giftCount??previous?.gifts.length??0)+(comment.gift?1:0),giftTotals:totals,nameHistory:history.slice(-20)};
}
