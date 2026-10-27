import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { randomBytes } from 'node:crypto';
import { WebSocket,WebSocketServer } from 'ws';
import { overlayHTML } from './overlay';
import { publicState } from './server';
import type { Snapshot } from '../shared/types';

// Explicitly enabled per run. Read-only and separate from the privileged local command API.
export async function startRemote(snapshot:()=>Snapshot,port=11181){
 const token=randomBytes(32).toString('hex');
 const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
 for(const list of Object.values(networkInterfaces()))for(const item of list||[])if(item.family==='IPv4'&&!item.internal)hosts.add(`${item.address}:${port}`);
 const html=overlayHTML.replace("location.host+'/ws'",`location.host+'/ws/${token}'`);
 const server=createServer((req,res)=>{if(!req.headers.host||!hosts.has(req.headers.host)){res.writeHead(403).end();return;}if(req.url?.split('?')[0]!==`/view/${token}`){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(html);});
 const wss=new WebSocketServer({noServer:true,maxPayload:1024});
 server.on('upgrade',(req,socket,head)=>{if(req.url!==`/ws/${token}`||!req.headers.host||!hosts.has(req.headers.host)||req.headers.origin!==`http://${req.headers.host}`){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
 const payload=()=>JSON.stringify(publicState(snapshot()));wss.on('connection',ws=>ws.send(payload()));
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',resolve);});
 return {urls:[...hosts].filter(host=>!host.startsWith('localhost')).map(host=>`http://${host}/view/${token}`),broadcast(){const data=payload();for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>2_000_000)ws.terminate();else ws.send(data);}},close(){for(const ws of wss.clients)ws.terminate();wss.close();server.close();server.closeAllConnections();}};
}
