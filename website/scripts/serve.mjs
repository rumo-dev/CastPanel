import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const app=express();app.use(express.static(root));const server=app.listen(Number(process.env.PORT)||0,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port));
