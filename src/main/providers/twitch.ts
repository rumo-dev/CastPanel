import WebSocket from 'ws';
import type { ICommentProvider } from './ICommentProvider';
import type { Comment,Connection } from '../../shared/types';
export function parseIRC(line:string) {
 const match=/^(?:@([^ ]+) )?(?::([^ ]+) )?(\w+)(?: ([^:]*))?(?: :(.*))?$/.exec(line);if(!match)return null;
 const tags=Object.fromEntries((match[1]||'').split(';').filter(Boolean).map(v=>{const [k,...rest]=v.split('=');return [k,rest.join('=').replace(/\\([sn:r\\])/g,(_,c:string)=>({'s':' ','n':'\n','r':'\r',':':';','\\':'\\'}[c]||c))];}));
 return {tags,prefix:match[2],command:match[3],text:match[5]||''};
}
export class TwitchProvider implements ICommentProvider {
 private socket?:WebSocket; private retry?:ReturnType<typeof setTimeout>; private stopped=true;
 async connect(config:Connection,emit:(c:Comment)=>void,status:(s:string)=>void){
  if(!/^[a-zA-Z0-9_]{1,25}$/.test(config.target))throw Error('Twitchユーザー名を指定してください');this.stopped=false;
  const start=()=>{if(this.stopped)return;const ws=this.socket=new WebSocket('wss://irc-ws.chat.twitch.tv:443');
   ws.on('open',()=>{ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');ws.send('PASS SCHMOOPIIE');ws.send(`NICK justinfan${Math.floor(Math.random()*90000+10000)}`);ws.send(`JOIN #${config.target.toLowerCase()}`);status('接続中（IRC）');});
   ws.on('message',data=>{for(const line of data.toString().split('\r\n')){if(line.startsWith('PING')){ws.send(line.replace('PING','PONG'));continue;}const r=parseIRC(line);if(!r)continue;
    if(r.command==='RECONNECT'){ws.close();continue;}if(!['PRIVMSG','USERNOTICE'].includes(r.command))continue;
    const bits=Number(r.tags.bits);const kind=r.tags['msg-id'];
    emit({id:`twitch:${r.tags.id||crypto.randomUUID()}`,connectionId:config.id,platform:'twitch',userId:r.tags['user-id']||r.prefix?.split('!')[0]||'system',username:r.tags['display-name']||'Twitch',text:r.text||r.tags['system-msg']||'',timestamp:new Date().toISOString(),emojis:[],gift:bits>0?{kind:'bits',amount:bits,currency:'BITS',label:`${bits} Bits`}:kind?.includes('sub')?{kind:'subscription',label:r.tags['system-msg']||kind}:r.tags['custom-reward-id']?{kind:'points',label:r.tags['custom-reward-id']}:undefined});
   }});
   ws.on('error',e=>status(`IRCエラー: ${e.message}`));ws.on('close',()=>{if(!this.stopped){status('再接続待機');this.retry=setTimeout(start,5000);}});
  };start();
 }
 disconnect(){this.stopped=true;if(this.retry)clearTimeout(this.retry);this.socket?.close();}
}
