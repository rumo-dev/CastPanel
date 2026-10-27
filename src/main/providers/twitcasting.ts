import { BrowserWindow } from 'electron';
import type { ICommentProvider } from './ICommentProvider';
import type { Comment,Connection } from '../../shared/types';

// Site DOM is not a stable API. Status explicitly reports lack of matching elements.
export class TwitcastingProvider implements ICommentProvider {
 private window?:BrowserWindow;
 private timer?:ReturnType<typeof setInterval>;
 private busy=false;
 async connect(config:Connection,emit:(c:Comment)=>void,status:(s:string)=>void){
  this.disconnect();const target=config.target.trim();let url:URL;
  if(target.startsWith('https://'))url=new URL(target);else url=new URL(`https://twitcasting.tv/${encodeURIComponent(target)}`);
  if(url.hostname!=='twitcasting.tv'||url.protocol!=='https:')throw Error('ツイキャスのURLかユーザー名を指定してください');
  const win=this.window=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,partition:'persist:twitcasting',backgroundThrottling:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,to)=>{if(new URL(to).hostname!=='twitcasting.tv')e.preventDefault();});
  await win.loadURL(url.href);if(win.isDestroyed()||this.window!==win)return;
  status('試験接続: コメントDOM待機');
  this.timer=setInterval(async()=>{if(this.busy||win.isDestroyed())return;this.busy=true;try{
   const result=await win.webContents.executeJavaScriptInIsolatedWorld(999,[{code:`(() => {
    if(!globalThis.__castSeen)globalThis.__castSeen=new Set();
    const nodes=document.querySelectorAll('[data-comment-id],.tw-comment-item');const rows=[];
    for(const el of nodes){const id=el.getAttribute('data-comment-id')||el.id;if(!id||globalThis.__castSeen.has(id))continue;
     const name=el.querySelector('.tw-comment-item-name,.tw-user-nav-name,[data-username]');const msg=el.querySelector('.tw-comment-item-comment,.tw-comment-item-text,[data-comment-text]');
     if(!name||!msg)continue;globalThis.__castSeen.add(id);if(globalThis.__castSeen.size>5000)globalThis.__castSeen.delete(globalThis.__castSeen.values().next().value);
     rows.push({id,username:name.textContent.trim(),userId:el.getAttribute('data-user-id')||name.getAttribute('href')||name.textContent.trim(),text:msg.textContent.trim()});
    }return {count:nodes.length,rows};})()`}]);
   status(result.count?'試験接続: DOM監視中':'試験接続: 対応DOMなし（ログイン・サイト変更を確認）');
   for(const r of result.rows)emit({...r,id:`twitcasting:${r.id}`,connectionId:config.id,platform:'twitcasting',timestamp:new Date().toISOString(),emojis:[]});
  }catch(error){if(!win.isDestroyed())status(`ツイキャス取得エラー: ${String(error)}`);}finally{this.busy=false;}},1000);
 }
 disconnect(){if(this.timer)clearInterval(this.timer);this.timer=undefined;if(this.window&&!this.window.isDestroyed())this.window.destroy();this.window=undefined;}
}
