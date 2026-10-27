import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { request,createServer } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import { startServer,startOverlayServer } from '../src/main/server';
import { startRemote } from '../src/main/remote';
import { emptyStudio } from '../src/shared/studio';
import type { Snapshot } from '../src/shared/types';
const snapshot=():Snapshot=>({settings:{connections:[],theme:'dark',ngWords:[],filterMode:'hide',replacements:{},ttsEngine:'speech',speaker:0},comments:[],listeners:{},statuses:{},update:'',overlayUrl:'',studio:emptyStudio(),effects:[],controlToken:'PRIVATE_TOKEN'});
test('HTTP command authentication, host/origin checks and sanitized WebSocket snapshot',async()=>{
 const port=randomInt(20000,30000);let calls=0;const server=await startServer(snapshot,port,{token:'test-secret',command:()=>{calls++;}});const base=`http://127.0.0.1:${port}`;
 try{
  assert.equal((await fetch(base+'/overlay')).status,200);
  const root=await fetch(base+'/overlay',{redirect:'manual'});assert.equal(root.status,200);assert.equal(root.headers.get('location'),null);assert.equal(root.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(base+'/api/state',{headers:{Origin:'https://untrusted.example'}})).status,403);
  const hostStatus=await new Promise<number|undefined>((resolve,reject)=>{const req=request(base+'/api/state',{headers:{Host:'untrusted.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(hostStatus,403);
  const body=JSON.stringify({type:'clear'});
  assert.equal((await fetch(base+'/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body})).status,401);
  assert.equal((await fetch(base+'/api/command',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-secret'},body})).status,200);assert.equal(calls,1);
  assert.equal((await fetch(base+'/api/command',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-secret'},body:'{"type":"unknown"}'})).status,400);
  await new Promise<void>((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,{origin:base});ws.on('error',reject);ws.once('message',data=>{try{const s=JSON.parse(data.toString());assert.equal(s.theme,'dark');assert.ok(!data.toString().includes('PRIVATE_TOKEN'));ws.close();resolve();}catch(e){reject(e);}});});
 }finally{server.close();}
});
test('LAN viewer requires secret path and does not expose command API',async()=>{
 const port=randomInt(30000,40000);const remote=await startRemote(snapshot,port);const url=remote.urls.find(url=>url.includes('127.0.0.1'))!;
 try{assert.equal((await fetch(url)).status,200);assert.equal((await fetch(`http://127.0.0.1:${port}/view/wrong`)).status,404);assert.equal((await fetch(`http://127.0.0.1:${port}/api/command`,{method:'POST'})).status,404);const html=await (await fetch(url)).text();assert.ok(html.includes(`/ws/${url.split('/').pop()}`));}finally{remote.close();}
});
test('occupied port is left untouched; OBS URL, health and WebSocket use the fallback port',async()=>{
 const other=createServer((_,res)=>res.writeHead(404,{'Content-Type':'application/json'}).end('{"message":"Route GET:/overlay not found"}'));
 other.listen(0,'127.0.0.1');await once(other,'listening');const address=other.address();assert.ok(address&&typeof address!=='string');
 const server=await startOverlayServer(snapshot,undefined,address.port,[0]);
 try{
  assert.notEqual(server.port,address.port);assert.equal(server.overlayUrl,`${server.baseUrl}/overlay`);
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/overlay`)).status,404);
  const response=await fetch(server.overlayUrl);assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/text\/html/);assert.match(await response.text(),/CastPanel OBS/);
  assert.deepEqual(await (await fetch(server.baseUrl+'/api/health')).json(),{application:'CastPanel',protocol:1,port:server.port});
  await new Promise<void>((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${server.port}/ws`,{origin:server.baseUrl});ws.on('error',reject);ws.once('message',data=>{try{assert.equal(JSON.parse(data.toString()).theme,'dark');ws.close();resolve();}catch(error){reject(error);}});});
 }finally{server.close();other.closeAllConnections();other.close();}
});
test('automatic fallback does not hide invalid port configuration errors',async()=>{await assert.rejects(startOverlayServer(snapshot,undefined,-1,[0]),/port/i);});

