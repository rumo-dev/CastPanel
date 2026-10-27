import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { LibreTranslate,VTubeStudio } from '../src/main/integrations';
import { trustedMedia } from '../src/shared/media';
test('translation speaks LibreTranslate protocol and rejects malformed results',async()=>{
 let count=0;const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);assert.equal(req.url,'/translate');assert.equal(data.q,'hello');assert.equal(data.source,'auto');assert.equal(data.target,'ja');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(count++?{wrong:'value'}:{translatedText:'こんにちは'}));});server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
 try{const engine=new LibreTranslate(`http://127.0.0.1:${address.port}`);assert.equal(await engine.translate('hello','ja'),'こんにちは');await assert.rejects(engine.translate('hello','ja'),/不正/);}finally{server.closeAllConnections();server.close();}
});
test('VTube Studio authenticates and triggers a hotkey over its request protocol',async()=>{
 const server=new WebSocketServer({port:0,host:'127.0.0.1'});await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');let triggered='';
 server.on('connection',ws=>ws.on('message',raw=>{const message=JSON.parse(raw.toString());const type=message.messageType;const data=type==='AuthenticationTokenRequest'?{authenticationToken:'mock-token'}:type==='AuthenticationRequest'?{authenticated:message.data.authenticationToken==='mock-token'}:{hotkeyID:message.data.hotkeyID};if(type==='HotkeyTriggerRequest')triggered=message.data.hotkeyID;ws.send(JSON.stringify({requestID:message.requestID,messageType:type.replace('Request','Response'),data}));}));
 const client=new VTubeStudio(`ws://127.0.0.1:${address.port}`);
 try{assert.equal(await client.connect(),'mock-token');await client.trigger('smile');assert.equal(triggered,'smile');client.disconnect();await assert.rejects(client.trigger('smile'),/先に接続/);}finally{client.disconnect();for(const ws of server.clients)ws.terminate();server.close();}
});
test('media rejects arbitrary hosts, credential tricks and non-HTTPS',()=>{assert.equal(trustedMedia('https://www.youtube.com/s/emoji.png'),'https://www.youtube.com/s/emoji.png');assert.equal(trustedMedia('https://www.youtube.com.evil.example/x'),undefined);assert.equal(trustedMedia('javascript:alert(1)'),undefined);assert.equal(trustedMedia('http://www.youtube.com/x'),undefined);assert.equal(trustedMedia('https://user@www.youtube.com/x'),undefined);});

