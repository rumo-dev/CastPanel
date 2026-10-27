import { app,BrowserWindow,ipcMain } from 'electron';
import updater from 'electron-updater';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Repository,LogWriter } from './storage';
import { startServer } from './server';
import { YouTubeProvider } from './providers/youtube';
import { TwitchProvider } from './providers/twitch';
import type { ICommentProvider } from './providers/ICommentProvider';
import type { Comment,Snapshot } from '../shared/types';
import { filterComment } from '../shared/filter';
// electron-updater is CommonJS; Node's ESM loader cannot infer its getter exports.
const { autoUpdater } = updater;
const dir=path.dirname(fileURLToPath(import.meta.url));
const settingsSchema=z.object({connections:z.array(z.object({id:z.string().min(1).max(80),platform:z.enum(['youtube','twitch','twitcasting']),target:z.string().max(2048),connect:z.boolean(),tts:z.boolean(),tracking:z.boolean(),export:z.boolean()})).max(20).refine(v=>new Set(v.map(c=>c.id)).size===v.length,'接続IDが重複しています'),theme:z.enum(['simple','pop','dark','bubble']),ngWords:z.array(z.string().max(100)).max(200),filterMode:z.enum(['hide','mask']),replacements:z.record(z.string().max(100),z.string().max(200)),ttsEngine:z.enum(['speech','voicevox','voicepeak']),speaker:z.number().int().min(0).max(10000)});
let win:BrowserWindow;let repo:Repository;let logs:LogWriter;let overlay:Awaited<ReturnType<typeof startServer>>|undefined;const providers=new Map<string,{provider:ICommentProvider;target:string;platform:string}>();let comments:Comment[]=[];const statuses:Record<string,string>={};let update='未確認';const seen=new Set<string>();let closing=false;
const snapshot=():Snapshot=>({settings:repo.settings,comments,listeners:repo.listeners,statuses,update,overlayUrl:'http://127.0.0.1:11180/overlay'});
function publish(){if(win&&!win.isDestroyed())win.webContents.send('state',snapshot());overlay?.broadcast();}
function receive(raw:Comment){if(closing||seen.has(raw.id))return;seen.add(raw.id);if(seen.size>5000)seen.delete(seen.values().next().value!);const cfg=repo.settings.connections.find(c=>c.id===raw.connectionId);if(!cfg)return;const c=filterComment(raw,repo.settings);if(!c)return;if(cfg.tracking)repo.track(c);if(cfg.export)void logs.write(c).catch(e=>{statuses[c.connectionId]=`ログ保存失敗: ${e.message}`;publish();});comments=[...comments,c].slice(-300);publish();}
async function reconcile(){for(const [id,p] of providers){const c=repo.settings.connections.find(c=>c.id===id);if(!c?.connect||c.target!==p.target||c.platform!==p.platform){p.provider.disconnect();providers.delete(id);statuses[id]='停止';}}
 for(const c of repo.settings.connections){if(closing)break;if(!c.connect||providers.has(c.id))continue;if(c.platform==='twitcasting'){statuses[c.id]='未実装: ICommentProviderを追加してください';continue;}const provider=c.platform==='youtube'?new YouTubeProvider():new TwitchProvider();providers.set(c.id,{provider,target:c.target,platform:c.platform});statuses[c.id]='接続処理中';try{await provider.connect(c,receive,s=>{statuses[c.id]=s;publish();});}catch(e){provider.disconnect();providers.delete(c.id);statuses[c.id]=String(e);}}publish();}
function createWindow(){win=new BrowserWindow({width:1280,height:850,minWidth:900,webPreferences:{preload:path.join(dir,'../preload/index.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.on('close',()=>{if(!closing)app.quit();});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());if(process.env.ELECTRON_RENDERER_URL)void win.loadURL(process.env.ELECTRON_RENDERER_URL);else void win.loadFile(path.join(dir,'../renderer/index.html'));}
if(!app.requestSingleInstanceLock())app.quit();else {
 app.on('second-instance',()=>{win?.show();win?.focus();});
 void app.whenReady().then(async()=>{repo=new Repository();logs=new LogWriter(path.join(app.getPath('userData'),'logs'));try{overlay=await startServer(snapshot);}catch(e){statuses.overlay=`OBSサーバー起動失敗: ${String(e)}`;}
 const guard=(event:Electron.IpcMainInvokeEvent)=>{if(closing||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Unauthorized IPC');};
 ipcMain.handle('snapshot',e=>{guard(e);return snapshot();});
 ipcMain.handle('save',async(e,value)=>{guard(e);repo.settings=settingsSchema.parse(value);await reconcile();});
 ipcMain.handle('demo',e=>{guard(e);const c=repo.settings.connections[0];if(c)receive({id:crypto.randomUUID(),connectionId:c.id,platform:c.platform,userId:'demo',username:'テストリスナー',text:'こんにちは！ www',timestamp:new Date().toISOString(),emojis:[],gift:{kind:'superchat',amount:1000,currency:'JPY',label:'¥1,000'}});});
 autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=false;
 for(const event of ['checking-for-update','update-available','update-not-available','update-downloaded'] as const)autoUpdater.on(event,()=>{update=event;publish();});autoUpdater.on('download-progress',p=>{update=`ダウンロード ${p.percent.toFixed(0)}%`;publish();});autoUpdater.on('error',e=>{update=`更新エラー: ${e.message}`;publish();});
 ipcMain.handle('update',async(e,action)=>{guard(e);if(!app.isPackaged){update='開発モードでは更新を無効化';publish();return;}if(action==='check')await autoUpdater.checkForUpdates();else if(action==='install'&&update==='update-downloaded')autoUpdater.quitAndInstall();});
 createWindow();await reconcile();if(!closing&&app.isPackaged)void autoUpdater.checkForUpdates().catch(()=>{});app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
 }).catch(e=>{console.error(e);app.quit();});
 let shutdownComplete=false;
 app.on('window-all-closed',()=>{if(!closing)app.quit();});
 app.on('before-quit',e=>{
  if(shutdownComplete)return;
  e.preventDefault();
  if(closing)return;
  closing=true;
  // Hidden provider windows prevent window-all-closed from firing on their own.
  for(const p of providers.values()){
   try{p.provider.disconnect();}catch(error){console.error('Disconnect failed',error);}
  }
  providers.clear();
  try{overlay?.close();}catch(error){console.error('Server shutdown failed',error);}
  // Normally flush all pending writes; a stalled filesystem must not keep the app alive forever.
  const deadline=setTimeout(()=>{console.error('Shutdown timed out waiting for logs');app.exit(1);},5000);
  void Promise.resolve(logs?.flush()).catch(console.error).finally(()=>{
   clearTimeout(deadline);
   shutdownComplete=true;
   app.quit();
  });
 });
}


