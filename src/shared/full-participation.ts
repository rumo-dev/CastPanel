import { z } from 'zod';
const integer=z.number().int().nonnegative();
const stats=z.object({name:z.string().max(300),joins:integer,total:integer,rounds:integer,firstAt:integer,lastAt:integer,lastLeaveAt:integer});
export const fullParticipationSchema=z.object({
 settings:z.record(z.string(),z.json()),
 queue:z.array(z.object({key:z.string().min(1).max(400),name:z.string().max(300),count:integer,avatar:z.string().max(2048).optional(),team:z.string().max(50).optional(),joinedAt:z.string().max(100).optional()})).max(1000),
 designs:z.array(z.record(z.string(),z.json())).max(30),
 blacklist:z.array(z.object({key:z.string().max(400),name:z.string().max(300),at:integer})).max(1000),
 stats:z.record(z.string().max(400),stats),
 log:z.array(z.object({t:integer,type:z.string().max(100),key:z.string().max(400),name:z.string().max(300),note:z.string().max(1000)})).max(200),
 auth:z.null(),
}).refine(value=>JSON.stringify(value).length<=2000000,'参加型設定が大きすぎます');
