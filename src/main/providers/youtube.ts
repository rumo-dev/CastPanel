import { BrowserWindow } from 'electron';
import type { ICommentProvider } from './ICommentProvider';
import type { Comment,Connection } from '../../shared/types';
import { parseMoney } from '../../shared/gift';
// Runs in the isolated world. No Node or IPC is exposed to the remote page.
const observe = `(() => {
 if(globalThis.__castObserver)return; globalThis.__castQueue=[];
 const seen=new Set();
 const scan=()=>document.querySelectorAll('yt-live-chat-text-message-renderer,yt-live-chat-paid-message-renderer,yt-live-chat-paid-sticker-renderer,yt-live-chat-membership-item-renderer').forEach(el=>{
 const id=el.id;if(!id||seen.has(id))return;seen.add(id);if(seen.size>5000)seen.delete(seen.values().next().value);
 const get=s=>el.querySelector(s)?.textContent?.trim()||'';
 const emojis=Array.from(el.querySelectorAll('#message img')).map(i=>({url:i.src,alt:i.alt||''}));
 const msg=el.querySelector('#message');const text=msg?Array.from(msg.childNodes).map(n=>n.nodeType===1&&n.tagName==='IMG'?n.alt:n.textContent).join(''):get('#header-subtext');
 const tag=el.tagName.toLowerCase();const label=get('#purchase-amount')||get('#header-subtext');
 globalThis.__castQueue.push({id,userId:el.getAttribute('author-external-channel-id')||get('#author-name'),username:get('#author-name'),text,emojis,gift:tag.includes('paid')?{kind:tag.includes('sticker')?'sticker':'superchat',label}:tag.includes('membership')?{kind:'membership',label}:undefined});
 if(globalThis.__castQueue.length>500)globalThis.__castQueue.shift();
 });
 globalThis.__castObserver=new MutationObserver(scan);globalThis.__castObserver.observe(document.documentElement,{childList:true,subtree:true});scan();
})()`;
export class YouTubeProvider implements ICommentProvider {
 private win?:BrowserWindow; private timer?:ReturnType<typeof setInterval>; private busy=false;
 async connect(config:Connection,emit:(c:Comment)=>void,status:(s:string)=>void) {
  this.disconnect();
  const win=this.win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,partition:'persist:youtube'}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(e,url)=>{if(new URL(url).hostname!=='www.youtube.com')e.preventDefault();});
  const raw=config.target.trim(); let url:URL;
  if(raw.startsWith('https://')) {url=new URL(raw);if(!['www.youtube.com','youtube.com','youtu.be'].includes(url.hostname))throw Error('YouTube URLを指定してください');}
  else url=new URL(raw.startsWith('@')?`https://www.youtube.com/${encodeURIComponent(raw)}/live`:`https://www.youtube.com/channel/${encodeURIComponent(raw)}/live`);
  let video=url.hostname==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v')||(/^\/(live|shorts)\/([^/]+)/.exec(url.pathname)?.[2]);
  if(!video){await win.loadURL(url.href);video=await win.webContents.executeJavaScript(`document.querySelector('link[rel="canonical"]')?.href?.match(/[?&]v=([^&]+)/)?.[1] || new URL(location.href).searchParams.get('v')`,true);}
  if(!video||!/^[\w-]{11}$/.test(video))throw Error('配信を解決できません。ライブ配信URLを指定してください');
  await win.loadURL(`https://www.youtube.com/live_chat?v=${video}`);
  if(win.isDestroyed()||this.win!==win)return;
  status('接続中（DOM監視）');
  this.timer=setInterval(async()=>{if(this.busy||win.isDestroyed())return;this.busy=true;try{
   await win.webContents.executeJavaScriptInIsolatedWorld(999,[{code:observe}]);
   const rows=await win.webContents.executeJavaScriptInIsolatedWorld(999,[{code:'globalThis.__castQueue.splice(0,100)'}]);
   for(const r of rows)if(typeof r.id==='string'&&typeof r.text==='string')emit({...r,gift:r.gift?{...r.gift,...parseMoney(r.gift.label)}:undefined,id:`youtube:${r.id}`,connectionId:config.id,platform:'youtube',timestamp:new Date().toISOString()});
  }catch(e){status(`取得エラー: ${String(e)}`);}finally{this.busy=false;}},750);
 }
 disconnect(){if(this.timer)clearInterval(this.timer);this.timer=undefined;this.win?.destroy();this.win=undefined;}
}
