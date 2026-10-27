import { createConnection } from 'node:net';
export function sendBouyomi(text:string){return new Promise<void>((resolve,reject)=>{
 const body=Buffer.from(text.slice(0,500),'utf8');const header=Buffer.alloc(15);header.writeInt16LE(1,0);header.writeInt16LE(-1,2);header.writeInt16LE(-1,4);header.writeInt16LE(-1,6);header.writeInt16LE(0,8);header.writeUInt8(0,10);header.writeInt32LE(body.length,11);
 const socket=createConnection({host:'127.0.0.1',port:50001});socket.setTimeout(3000,()=>socket.destroy(Error('棒読みちゃん接続タイムアウト')));socket.on('error',reject);socket.on('connect',()=>socket.end(Buffer.concat([header,body])));socket.on('close',hadError=>{if(!hadError)resolve();});
});}
