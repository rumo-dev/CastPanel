import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer,WebSocket } from 'ws';
import type { Snapshot } from '../shared/types';
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'"><title>CastPanel OBS</title><style>
body{background:transparent;color:white;font:24px sans-serif;margin:20px}#feed{display:flex;flex-direction:column;gap:10px}.comment{padding:12px 18px;border-radius:12px;background:#182234e8;overflow-wrap:anywhere}.simple .comment{background:#ffffffde;color:#172033}.pop .comment{background:#fa67a8;color:#fff;border:3px solid #fff}.bubble .comment{background:#fff;color:#213047;border-radius:26px 26px 26px 0}.gift{border-left:8px solid #fbbf24}.large{background:#8c2c64}.name{font-weight:bold;margin-right:16px}.first{font-size:16px;color:#38bdf8}#effect{position:fixed;right:20px;top:20px;background:#9e2358;padding:24px;border-radius:18px;display:none}
</style><div id="feed"></div><div id="effect"></div><script>
let seen=new Set(),initialized=false,timer;const feed=document.getElementById('feed');function connect(){const ws=new WebSocket('ws://'+location.host+'/ws');ws.onmessage=e=>{const s=JSON.parse(e.data);document.body.className=s.settings.theme;feed.replaceChildren();for(const c of s.comments.slice(-20)){const row=document.createElement('div');row.className='comment'+(c.gift?' gift':'')+((c.gift?.amount||0)>=1000?' large':'');const name=document.createElement('span');name.className='name';name.textContent=c.username;row.append(name);if(c.firstVisit){const b=document.createElement('span');b.className='first';b.textContent='初見 ';row.append(b);}row.append(document.createTextNode(c.text+(c.gift?' 🎁 '+c.gift.label:'')));feed.append(row);if(initialized&&c.gift&&!seen.has(c.id)){const p=document.getElementById('effect');p.textContent=c.username+' 🎉 '+c.gift.label;p.style.display='block';clearTimeout(timer);timer=setTimeout(()=>p.style.display='none',5000);}seen.add(c.id);}if(seen.size>2000)seen=new Set(s.comments.map(c=>c.id));initialized=true;};ws.onclose=()=>setTimeout(connect,2000);}connect();</script></html>`;
export async function startServer(snapshot:()=>Snapshot,port=11180){
 const app=express();app.use((req,res,next)=>{const host=req.headers.host;if(!host||!['127.0.0.1','localhost'].includes(host.split(':')[0])){res.sendStatus(403);return;}next();});
 app.get('/overlay',(_,res)=>res.type('html').send(html));
 const server=createServer(app);const wss=new WebSocketServer({noServer:true,maxPayload:1024});
 server.on('upgrade',(req,socket,head)=>{const origin=req.headers.origin;if(req.url!=='/ws'||!origin||![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin)){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>{wss.emit('connection',ws,req);});});
 const payload=()=>JSON.stringify({...snapshot(),listeners:{},settings:{theme:snapshot().settings.theme}});
 wss.on('connection',ws=>ws.send(payload()));
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve());});
 return {broadcast(){const data=payload();for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>2_000_000)ws.terminate();else ws.send(data);}},close(){for(const ws of wss.clients)ws.terminate();wss.close();server.close();server.closeAllConnections();}};
}
