import { z } from 'zod';
export const widgetNames={comments:'コメント',pinned:'固定コメント',gifts:'ギフト通知',queue:'参加待ち',poll:'アンケート',setlist:'セットリスト'};
export type Widget=keyof typeof widgetNames;
const widget=z.object({enabled:z.boolean(),x:z.number().min(0).max(100),y:z.number().min(0).max(100),width:z.number().min(5).max(100),height:z.number().min(3).max(100),fontSize:z.number().int().min(12).max(80),limit:z.number().int().min(1).max(100),seconds:z.number().int().min(0).max(3600)}).refine(w=>w.x+w.width<=100.01&&w.y+w.height<=100.01,'配置が画面の外にはみ出しています');
const base={enabled:true,x:2,y:2,width:30,height:30,fontSize:28,limit:5,seconds:30};
export const defaultWidgets={comments:{...base,x:68,y:35,height:60},pinned:{...base,x:2,y:90,width:62,height:8,limit:1,seconds:0},gifts:{...base,x:35,y:3,width:30,height:18,limit:1,seconds:8},queue:{...base,x:2,y:3,width:24,height:24,seconds:0},poll:{...base,x:2,y:32,width:28,height:48,seconds:20},setlist:{...base,enabled:false,x:35,y:25,width:30,height:55,seconds:0}};
export const layoutSchema=z.object({widgets:z.object({comments:widget,pinned:widget,gifts:widget,queue:widget,poll:widget,setlist:widget}).default(()=>structuredClone(defaultWidgets)),hidePinned:z.boolean().default(true),hideGifts:z.boolean().default(true),queueOnlyWhenEnabled:z.boolean().default(true)});
export type OverlayLayout=z.infer<typeof layoutSchema>;
export function overlayPreset(name:string):OverlayLayout{const layout=layoutSchema.parse({});if(name==='chat'){layout.widgets.comments={...layout.widgets.comments,x:4,y:28,width:58,height:58,fontSize:32,limit:8};}if(name==='song'){layout.widgets.setlist.enabled=true;layout.widgets.queue.enabled=false;layout.widgets.poll.enabled=false;}return layout;}

