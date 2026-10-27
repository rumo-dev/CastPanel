import { queueDockHTML } from './queue-dock';
import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer,WebSocket } from 'ws';
import type { Snapshot } from '../shared/types';
import { commandSchema,type StudioCommand } from '../shared/studio';
import { overlayHTML,sdkJS } from './overlay';
import { pollCounts,pollIsActive } from '../shared/poll';
export function publicState(s:Snapshot){
 const allow=(id:string)=>s.settings.connections.find(c=>c.id===id)?.overlay!==false;
 const blocked=(c:Snapshot['comments'][number])=>s.studio.profiles[`${c.platform}:${c.userId}`]?.blocked;
 const clean=(c:Snapshot['comments'][number])=>({...c,nickname:s.studio.profiles[`${c.platform}:${c.userId}`]?.nickname||c.nickname});
 const poll=s.studio.poll;
 return {fullQueue:!!s.studio.fullParticipation,customTheme:s.settings.customThemes?.find(t=>t.id===s.settings.obsCustomTheme),theme:s.settings.theme,comments:s.comments.filter(c=>allow(c.connectionId)&&!blocked(c)).map(clean),effects:s.effects,
  overlay:s.studio.overlay,queueEnabled:s.studio.participation.enabled,pinned:s.studio.pinned&&allow(s.studio.pinned.connectionId)&&!blocked(s.studio.pinned)?clean(s.studio.pinned):null,
  queue:s.studio.participation.queue.map((e,i)=>({name:e.name,plays:e.plays,team:e.team,playing:i<s.studio.participation.config.slots})),queueConfig:{slots:s.studio.participation.config.slots,limit:s.studio.participation.config.limit},queueAppearance:s.studio.participation.appearance,setlist:s.studio.setlist,
  poll:poll?{title:poll.title,options:poll.options,active:pollIsActive(poll),counts:pollCounts(poll),correct:pollIsActive(poll)?-1:poll.correct,mode:poll.mode,closesAt:poll.closesAt,endedAt:poll.endedAt,answerPrefix:poll.answerPrefix}:null};
}
export interface ServerControl {token:string;command:(c:StudioCommand)=>void;templateRoot?:string;sanka?:import('./sanka').SankaRuntime}
export async function startServer(snapshot:()=>Snapshot,requestedPort=11280,control?:ServerControl){
 let port=requestedPort;
 const app=express();app.disable('x-powered-by');
 const origins=()=>[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
 app.use((req,res,next)=>{const host=req.headers.host;const origin=req.headers.origin;if(!host||![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)||origin&&!origins().includes(origin)){res.sendStatus(403);return;}res.setHeader('Cache-Control','no-store');next();});
 if(control?.sanka)app.use('/sanka',control.sanka.router);
 app.get('/api/health',(_,res)=>res.json({application:'CastPanel',protocol:1,port}));
 app.get(['/overlay','/view'],(_,res)=>res.type('html').send(overlayHTML));
 app.get('/queue-control',(_,res)=>res.type('html').send(queueDockHTML));
 app.get('/sdk.js',(_,res)=>res.type('js').send(sdkJS));
 if(control?.templateRoot)app.use('/templates',(req,res,next)=>{res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src data:; frame-ancestors 'none'");next();},express.static(control.templateRoot,{dotfiles:'deny',index:false,redirect:false}));
 app.get('/api/state',(_,res)=>res.json(publicState(snapshot())));
 app.get('/api/comments',(_,res)=>res.json(publicState(snapshot()).comments));
 app.post('/api/command',express.json({limit:'16kb'}),(req,res)=>{if(!control||req.headers.authorization!==`Bearer ${control.token}`){res.sendStatus(401);return;}const parsed=commandSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:'Invalid command'});return;}try{control.command(parsed.data);res.json({ok:true});}catch(error){res.status(400).json({error:String(error)});}});
 const server=createServer(app);const wss=new WebSocketServer({noServer:true,maxPayload:1024});
 server.on('upgrade',(req,socket,head)=>{const host=req.headers.host;if(!['/ws','/sanka/ws'].includes(req.url||'')||!host||![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)||!req.headers.origin||!origins().includes(req.headers.origin)){socket.destroy();return;}const target=req.url==='/sanka/ws'?control?.sanka?.sockets:wss;if(!target){socket.destroy();return;}target.handleUpgrade(req,socket,head,ws=>target.emit('connection',ws,req));});
 const payload=()=>JSON.stringify(publicState(snapshot()));wss.on('connection',ws=>ws.send(payload()));
 try{await new Promise<void>((resolve,reject)=>{const error=(cause:Error)=>reject(cause);server.once('error',error);server.listen(requestedPort,'127.0.0.1',()=>{server.removeListener('error',error);resolve();});});}catch(error){wss.close();server.close();throw error;}
 const address=server.address();if(!address||typeof address==='string')throw Error('OBSサーバーのポートを取得できません');port=address.port;
 return {port,baseUrl:`http://127.0.0.1:${port}`,overlayUrl:`http://127.0.0.1:${port}/overlay`,broadcast(){const data=payload();for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>2_000_000)ws.terminate();else ws.send(data);}},close(){for(const ws of wss.clients)ws.terminate();wss.close();server.close();server.closeAllConnections();}};
}
export async function startOverlayServer(snapshot:()=>Snapshot,control?:ServerControl,preferredPort=11280,fallbackPorts=[11280,11281,11282,11283,11284,0]){
 let lastError:unknown;
 for(const port of new Set([preferredPort,...fallbackPorts])){
  try{return await startServer(snapshot,port,control);}catch(error){lastError=error;if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code||''))throw error;}
 }
 throw lastError||Error('OBSサーバーを開始できません');
}





