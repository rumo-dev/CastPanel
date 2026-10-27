import { appIcon } from './branding';
import { SankaRuntime } from './sanka';
import { panelSchema,panelNames,type Panel } from '../shared/windows';
import { themeFileSchema,customThemeSchema } from '../shared/custom-themes';
import { app,BrowserWindow,ipcMain,dialog,shell,safeStorage } from 'electron';
import updater from 'electron-updater';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile,readFile,mkdir,readdir,stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Repository,LogWriter } from './storage';
import { Archive,Backups } from './archive';
import { startServer,startOverlayServer } from './server';
import Store from 'electron-store';
import { YouTubeProvider } from './providers/youtube';
import { TwitchProvider } from './providers/twitch';
import { TwitcastingProvider } from './providers/twitcasting';
import type { ICommentProvider } from './providers/ICommentProvider';
import type { Comment,Snapshot,Settings } from '../shared/types';
import { commandSchema,commentSchema,settingsSchema,testerSchema,type Effect,type StudioCommand } from '../shared/studio';
import { applyCommand,processStudio,userKey } from './studio';
import { filterComment } from '../shared/filter';
import { sendBouyomi } from './bouyomi';
import { LibreTranslate,PluginDispatcher,VTubeStudio } from './integrations';
import { startRemote } from './remote';
import { expirePoll,formatTimestamp } from '../shared/poll';
import { WindowPlacement } from './window-state';

const { autoUpdater } = updater;
if(process.platform==='win32')app.setAppUserModelId('jp.castpanel.desktop');
const dir=path.dirname(fileURLToPath(import.meta.url));
let win:BrowserWindow;
let sanka:SankaRuntime;const popouts=new Map<Panel,BrowserWindow>();const trustedWindows=new Set<BrowserWindow>();
let windowPlacement:WindowPlacement;
let repo:Repository;
let logs:LogWriter;
let archive:Archive;
let backups:Backups;
let backupTimer:ReturnType<typeof setInterval>|undefined;
let pollTimer:ReturnType<typeof setTimeout>|undefined;
let overlay:Awaited<ReturnType<typeof startServer>>|undefined;
let remote:Awaited<ReturnType<typeof startRemote>>|undefined;
const providers=new Map<string,{provider:ICommentProvider;target:string;platform:string}>();
const statuses:Record<string,string>={};
const seen=new Set<string>();
const visits=new Set<string>();
const cooldowns=new Map<string,number>();
let comments:Comment[]=[];
let effects:Effect[]=[];
let update='未確認';
let closing=false;
let shutdownComplete=false;
let saving=Promise.resolve();let reconcileVersion=0;
const controlToken=randomBytes(32).toString('hex');
const translator=new LibreTranslate();
const plugins=new PluginDispatcher();
const vts=new VTubeStudio();
let translating=0;
let templates:{id:string;name:string}[]=[];
const snapshot=():Snapshot=>({settings:repo.settings,comments,listeners:repo.listeners,statuses,update,overlayUrl:overlay?.overlayUrl||'',studio:repo.studio,effects,controlToken,templates,remoteUrls:remote?.urls||[]});
function publish(){sanka?.updateStatus(update);for(const w of trustedWindows)if(!w.isDestroyed())w.webContents.send('state',snapshot());overlay?.broadcast();remote?.broadcast();}
function report(id:string,error:unknown){statuses[id]=String(error);if(!closing)publish();}
function schedulePollDeadline(){
 if(pollTimer)clearTimeout(pollTimer);pollTimer=undefined;if(closing)return;
 const studio=repo.studio;const poll=studio.poll;if(!poll?.active||!poll.closesAt)return;
 if(expirePoll(studio)){repo.studio=studio;publish();return;}
 pollTimer=setTimeout(()=>{pollTimer=undefined;const current=repo.studio;if(expirePoll(current)){repo.studio=current;publish();}else schedulePollDeadline();},Math.max(1,Date.parse(poll.closesAt)-Date.now()));
}
function emitEffects(items:Effect[]){effects=[...effects,...items].slice(-30);for(const effect of items)if(effect.hotkey)void vts.trigger(effect.hotkey).catch(e=>report('vts',e));}
function translate(id:string){const c=comments.find(c=>c.id===id);if(!c)return;if(translating>=4){report('translation','翻訳が混雑しています');return;}translating++;void translator.translate(c.text,repo.studio.translation.target).then(text=>{if(closing)return;comments=comments.map(row=>row.id===id?{...row,translation:text}:row);publish();}).catch(e=>report('translation',e)).finally(()=>translating--);}
function executeCommand(command:StudioCommand){
 if(sanka?.command(command,comments)){publish();return;}
 const studio=repo.studio;comments=applyCommand(studio,comments,command);
 if(command.type==='effect'){const rule=studio.rules.find(r=>r.id===command.id);if(rule)emitEffects([{id:crypto.randomUUID(),message:rule.message,timestamp:new Date().toISOString(),hotkey:rule.hotkey}]);}
 if(command.type==='clear')effects=[];
 repo.studio=studio;if(command.type.startsWith('poll-'))schedulePollDeadline();if(command.type==='translate')translate(command.id);publish();
}
function receive(raw:Comment){
 const parsed=commentSchema.safeParse(raw);if(!parsed.success)return;raw=parsed.data;
 if(closing||seen.has(raw.id))return;
 seen.add(raw.id);if(seen.size>5000)seen.delete(seen.values().next().value!);
 const config=repo.settings.connections.find(c=>c.id===raw.connectionId);if(!config)return;
 let studio=repo.studio;if(studio.profiles[userKey(raw)]?.blocked)return;
 const c=filterComment(raw,repo.settings);if(!c)return;
 if(config.tracking){repo.track(c);const key=`${config.id}:${userKey(c)}`;c.newVisit=!visits.has(key);c.returning=c.newVisit&&!c.firstVisit;visits.add(key);}
 sanka?.receive(c);studio=repo.studio;const generated=processStudio(studio,c,cooldowns,!!sanka);if(config.overlay!==false)emitEffects(generated);repo.studio=studio;
 if(config.export){void logs.write(c).catch(e=>report('logs',e));void archive.write(c).catch(e=>report('logs',e));}
 comments=[...comments,c].slice(-500);plugins.dispatch(c,studio.plugins,(id,error)=>report(`plugin:${id}`,error));if(studio.translation.enabled)translate(c.id);publish();
}
async function reconcile(){const version=++reconcileVersion;
 for(const [id,p] of providers){const config=repo.settings.connections.find(c=>c.id===id);if(!config?.connect||config.target!==p.target||config.platform!==p.platform){p.provider.disconnect();providers.delete(id);statuses[id]='停止';}}
 for(const config of repo.settings.connections){
  if(closing||version!==reconcileVersion)break;if(!config.connect||providers.has(config.id))continue;
  const provider=config.platform==='youtube'?new YouTubeProvider():config.platform==='twitch'?new TwitchProvider():new TwitcastingProvider();
  providers.set(config.id,{provider,target:config.target,platform:config.platform});statuses[config.id]='接続処理中';
  try{await provider.connect(config,c=>{if(providers.get(config.id)?.provider===provider)receive(c);},s=>{if(!closing&&providers.get(config.id)?.provider===provider){statuses[config.id]=s;publish();}});}catch(error){provider.disconnect();providers.delete(config.id);report(config.id,error);}
 }if(!closing)publish();
}
function saveSettings(value:Settings){saving=saving.catch(()=>{}).then(async()=>{if(closing)return;repo.settings=value;sanka?.refresh();await reconcile();publish();});return saving;}
function createWindow(){
 const placement=windowPlacement.restore();
 win=new BrowserWindow({icon:appIcon,...placement.bounds,minWidth:placement.minWidth,minHeight:placement.minHeight,webPreferences:{preload:path.join(dir,'../preload/index.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 trustedWindows.add(win);
 if(placement.maximized)win.maximize();windowPlacement.track(win);
 win.on('close',()=>{if(!closing)app.quit();});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
 if(process.env.ELECTRON_RENDERER_URL)void win.loadURL(process.env.ELECTRON_RENDERER_URL);else void win.loadFile(path.join(dir,'../renderer/index.html'));
}
async function openPopout(panel:Panel){const old=popouts.get(panel);if(old&&!old.isDestroyed()){old.show();old.focus();return;}const w=new BrowserWindow({icon:appIcon,width:1000,height:760,minWidth:400,minHeight:300,title:'CastPanel — '+panelNames[panel],webPreferences:{preload:path.join(dir,'../preload/index.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});popouts.set(panel,w);trustedWindows.add(w);w.setMenu(null);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());w.on('closed',()=>{trustedWindows.delete(w);popouts.delete(panel);});if(process.env.ELECTRON_RENDERER_URL){const url=new URL(process.env.ELECTRON_RENDERER_URL);url.searchParams.set('panel',panel);await w.loadURL(url.href);}else await w.loadFile(path.join(dir,'../renderer/index.html'),{query:{panel}});}
function login(id:string){
 const config=repo.settings.connections.find(c=>c.id===id);if(!config)throw Error('接続先がありません');
 const youtube=config.platform==='youtube';const twitch=config.platform==='twitch';
 const hosts=youtube?['www.youtube.com','accounts.google.com']:twitch?['www.twitch.tv','passport.twitch.tv','id.twitch.tv']:['twitcasting.tv','ssl.twitcasting.tv','twitter.com','x.com','api.twitter.com'];
 const browser=new BrowserWindow({icon:appIcon,width:1000,height:800,title:'配信サイトへのログイン',webPreferences:{partition:`persist:${config.platform}`,sandbox:true,contextIsolation:true,nodeIntegration:false}});
 browser.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 browser.webContents.on('will-navigate',(event,url)=>{try{const target=new URL(url);if(target.protocol!=='https:'||!hosts.includes(target.hostname))event.preventDefault();}catch{event.preventDefault();}});
 return browser.loadURL(youtube?'https://www.youtube.com/':twitch?'https://www.twitch.tv/login':'https://twitcasting.tv/login');
}
function registerIPC(){
 const guard=(event:Electron.IpcMainInvokeEvent)=>{if(closing||![...trustedWindows].some(w=>!w.isDestroyed()&&event.sender===w.webContents&&event.senderFrame===w.webContents.mainFrame))throw Error('Unauthorized IPC');};
 ipcMain.handle('popout',(event,value,mini)=>{guard(event);const panel=panelSchema.parse(value);if(panel==='participation')return sanka.open(mini===true);return openPopout(panel);});
 ipcMain.handle('pin-window',(event,on)=>{guard(event);BrowserWindow.fromWebContents(event.sender)?.setAlwaysOnTop(z.boolean().parse(on));});
 ipcMain.handle('theme-file',async(event,action,input)=>{guard(event);const owner=BrowserWindow.fromWebContents(event.sender)!;if(action==='import'){const result=await dialog.showOpenDialog(owner,{properties:['openFile'],filters:[{name:'CastPanel theme',extensions:['json']}]});const file=result.filePaths[0];if(!file)return;if((await stat(file)).size>100000)throw Error('100KB以下のテーマファイルが必要です');return themeFileSchema.parse(JSON.parse(await readFile(file,'utf8'))).theme;}if(action!=='export')throw Error('Invalid action');const theme=customThemeSchema.parse(input);const result=await dialog.showSaveDialog(owner,{defaultPath:'castpanel-theme.json',filters:[{name:'JSON',extensions:['json']}]});if(result.filePath)await writeFile(result.filePath,JSON.stringify({type:'castpanel-theme',version:1,theme},null,2));});
 ipcMain.handle('snapshot',event=>{guard(event);return snapshot();});
 ipcMain.handle('reset-window',event=>{guard(event);windowPlacement.reset(win);});
 ipcMain.handle('save',async(event,value)=>{guard(event);await saveSettings(settingsSchema.parse(value));});
 ipcMain.handle('demo',(event,input)=>{guard(event);const value=input?testerSchema.parse(input):{connectionId:repo.settings.connections[0]?.id,username:'テストリスナー',userId:'demo',text:'こんにちは！ www',giftLabel:'¥1,000',amount:1000};const config=repo.settings.connections.find(c=>c.id===value.connectionId);if(!config)throw Error('接続枠を追加してください');receive({id:crypto.randomUUID(),connectionId:config.id,platform:config.platform,userId:value.userId,username:value.username,text:value.text,timestamp:new Date().toISOString(),emojis:[],gift:value.giftLabel?{kind:'superchat',amount:value.amount,currency:'JPY',label:value.giftLabel}:undefined});});
 ipcMain.handle('command',(event,input)=>{guard(event);executeCommand(commandSchema.parse(input));});
 ipcMain.handle('logs',async(event,input)=>{guard(event);const query=z.object({query:z.string().max(300),from:z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),to:z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),platform:z.enum(['','youtube','twitch','twitcasting'])}).parse(input);return archive.search(query);});
 ipcMain.handle('backups',event=>{guard(event);return backups.list();});
 ipcMain.handle('backup',event=>{guard(event);return backups.create(repo.export());});
 ipcMain.handle('restore',async(event,input)=>{guard(event);const name=z.string().max(200).parse(input);const data=repo.validate(await backups.read(name));reconcileVersion++;await backups.create(repo.export());for(const p of providers.values())p.provider.disconnect();providers.clear();repo.restore(data);repo.settings={...repo.settings,connections:repo.settings.connections.map(c=>({...c,connect:false}))};comments=[];effects=[];visits.clear();seen.clear();sanka?.restore();schedulePollDeadline();publish();});
 ipcMain.handle('login',(event,id)=>{guard(event);return login(z.string().max(80).parse(id));});
 ipcMain.handle('open-folder',async(event,input)=>{guard(event);const kind=z.enum(['logs','data','backups']).parse(input);const root=app.getPath('userData');const target=kind==='data'?root:path.join(root,kind);const {mkdir}=await import('node:fs/promises');await mkdir(target,{recursive:true});const error=await shell.openPath(target);if(error)throw Error(error);});
 ipcMain.handle('export-data',async(event,input)=>{guard(event);const kind=z.enum(['listeners','timestamps','setlist','stocks']).parse(input);const studio=repo.studio;const json=kind==='listeners'||kind==='stocks';const result=await dialog.showSaveDialog(win,{defaultPath:`castpanel-${kind}.${json?'json':'txt'}`,filters:[{name:json?'JSON':'Text',extensions:[json?'json':'txt']}]});if(result.canceled||!result.filePath)return;const text=kind==='listeners'?JSON.stringify({listeners:repo.listeners,profiles:studio.profiles},null,2):kind==='stocks'?JSON.stringify(studio.stocks,null,2):kind==='setlist'?studio.setlist.map((s,i)=>`${i+1}. ${s.title} / ${s.artist}`).join('\n'):[...studio.timestamps].sort((a,b)=>a.seconds-b.seconds).map(t=>`${formatTimestamp(t.seconds)} ${t.label}`).join('\n');await writeFile(result.filePath,text,'utf8');});
 ipcMain.handle('bouyomi',(event,text)=>{guard(event);return sendBouyomi(z.string().max(1000).parse(text));});
 ipcMain.handle('remote',async(event,input)=>{guard(event);const enabled=z.boolean().parse(input);if(enabled){if(!remote){const started=await startRemote(snapshot);if(closing){started.close();return;}remote=started;}}else{remote?.close();remote=undefined;}publish();});
 ipcMain.handle('cleanup-logs',async(event,input)=>{guard(event);const before=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(input);await Promise.all([logs.flush(),archive.flush()]);const root=path.join(app.getPath('userData'),'logs');const files=await readdir(root).catch(()=>[]);let count=0;for(const name of files)if(/^\d{4}-\d{2}-\d{2}_(youtube|twitch|twitcasting)\.(txt|jsonl)$/.test(name)&&name.slice(0,10)<before){await shell.trashItem(path.join(root,name));count++;}return count;});
 ipcMain.handle('vts',async(event,input,hotkey)=>{guard(event);const action=z.enum(['connect','disconnect','trigger']).parse(input);if(action==='disconnect'){vts.disconnect();statuses.vts='停止';}else if(action==='trigger'){await vts.trigger(z.string().min(1).max(100).parse(hotkey));}else{const file=path.join(app.getPath('userData'),'vts-token.bin');let token:string|undefined;if(safeStorage.isEncryptionAvailable()){try{token=safeStorage.decryptString(await readFile(file));}catch{}}const result=await vts.connect(token);if(safeStorage.isEncryptionAvailable())await writeFile(file,safeStorage.encryptString(result));statuses.vts='VTube Studio 接続中';}publish();});
 ipcMain.handle('install-template',async event=>{guard(event);const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'HTML template',extensions:['html']}]});const file=result.filePaths[0];if(result.canceled||!file)return;if(path.extname(file).toLowerCase()!=='.html'||(await stat(file)).size>1_000_000)throw Error('1MB以下のHTMLファイルを指定してください');const root=path.join(app.getPath('userData'),'templates');await mkdir(root,{recursive:true});const id=`${crypto.randomUUID()}.html`;await writeFile(path.join(root,id),await readFile(file));templates.push({id,name:path.basename(file)});publish();});
 ipcMain.handle('update',async(event,action)=>{guard(event);if(!app.isPackaged){update='開発モードでは更新を無効化';publish();return;}if(action==='check')await autoUpdater.checkForUpdates();else if(action==='install'&&update==='update-downloaded')autoUpdater.quitAndInstall();});
}
function shutdown(event:Electron.Event){
 if(shutdownComplete)return;event.preventDefault();if(closing)return;closing=true;
 if(backupTimer)clearInterval(backupTimer);
 if(pollTimer)clearTimeout(pollTimer);
 sanka?.close();vts.disconnect();
 for(const p of providers.values())try{p.provider.disconnect();}catch(error){console.error(error);}providers.clear();
 try{overlay?.close();}catch(error){console.error(error);}
 try{remote?.close();}catch(error){console.error(error);}
 const deadline=setTimeout(()=>{console.error('Shutdown timed out waiting for logs');app.exit(1);},5000);
 void Promise.allSettled([logs?.flush(),archive?.flush()]).finally(()=>{clearTimeout(deadline);shutdownComplete=true;app.quit();});
}
if(!app.requestSingleInstanceLock())app.quit();else {
 app.on('second-instance',()=>{if(win&&!win.isDestroyed()){win.show();win.focus();}});
 app.on('before-quit',shutdown);app.on('window-all-closed',()=>{if(!closing)app.quit();});
 void app.whenReady().then(async()=>{
  if(process.platform==='darwin')app.dock?.setIcon(appIcon);
  const root=app.getPath('userData');repo=new Repository();windowPlacement=new WindowPlacement();logs=new LogWriter(path.join(root,'logs'));archive=new Archive(path.join(root,'logs'));backups=new Backups(path.join(root,'backups'));
  sanka=new SankaRuntime(repo,publish,controlToken,()=>{void reconcile();},action=>action==='themes'?openPopout('themes'):action==='install'?autoUpdater.quitAndInstall():autoUpdater.checkForUpdates());
  await archive.importLegacy().catch(console.error);
  await backups.daily(repo.export()).catch(console.error);backupTimer=setInterval(()=>{void backups.daily(repo.export()).catch(console.error);},3600000);
  const templateRoot=path.join(root,'templates');await mkdir(templateRoot,{recursive:true});templates=(await readdir(templateRoot)).filter(name=>/^[\w-]+\.html$/.test(name)).map(id=>({id,name:id}));
  const serverPreferences=new Store<{port:number}>({name:'server-state',defaults:{port:11280}});
  const savedPort=z.number().int().min(1024).max(65535).safeParse(serverPreferences.get('port'));
  try{overlay=await startOverlayServer(snapshot,{token:controlToken,command:executeCommand,templateRoot,sanka},savedPort.success?savedPort.data:11280);}catch(error){statuses.overlay=`OBSサーバー起動失敗: ${String(error)}`;}
  if(overlay)try{serverPreferences.set('port',overlay.port);}catch(error){console.error('OBS port preference could not be saved',error);}
  autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=false;
  for(const event of ['checking-for-update','update-available','update-not-available','update-downloaded'] as const)autoUpdater.on(event,()=>{update=event;publish();});
  autoUpdater.on('download-progress',progress=>{update=`ダウンロード ${progress.percent.toFixed(0)}%`;publish();});autoUpdater.on('error',error=>{update=`更新エラー: ${error.message}`;publish();});
  if(overlay)sanka.setBase(overlay.baseUrl);void sanka.start();registerIPC();createWindow();schedulePollDeadline();await reconcile();if(!closing&&app.isPackaged&&sanka.autoUpdates())void autoUpdater.checkForUpdates().catch(()=>{});
 }).catch(error=>{console.error(error);app.quit();});
}





