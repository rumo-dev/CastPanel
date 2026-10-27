import { app,BrowserWindow } from 'electron';
import { mkdirSync,writeFileSync,mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync(resolve('.smoke-data'),{recursive:true});app.setPath('userData',mkdtempSync(resolve('.smoke-data/site-')));
if(process.env.SITE_CANVAS_NATIVE==='1')app.commandLine.appendSwitch('enable-blink-features','CanvasDrawElement');
const timer=setTimeout(()=>{console.error('Site smoke timeout');app.exit(1);},40000);
void app.whenReady().then(async()=>{
try{
 const win=new BrowserWindow({show:false,width:1440,height:1080,backgroundColor:'#fafaff',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 await win.loadURL(process.env.SITE_URL||'http://127.0.0.1:62310');
 await win.webContents.executeJavaScript(`new Promise(resolve=>{let n=0;const check=()=>{if(document.querySelector('#demo-host')?.dataset.rendering||n++>100)resolve();else setTimeout(check,30);};check();})`);
 const state=await win.webContents.executeJavaScript(`(()=>({mode:document.querySelector('#demo-host').dataset.rendering,overflow:document.documentElement.scrollWidth>innerWidth+1,title:document.title,images:Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0),nativeAPI:typeof document.createElement('canvas').getContext('2d').drawElementImage==='function'}))()`);
 console.log('SITE STATE',JSON.stringify(state));
 if(state.overflow||!state.images||!state.mode)throw Error('Invalid desktop preview '+JSON.stringify(state));
 writeFileSync(resolve('.smoke-data/site-desktop.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 const click=async selector=>{const point=await win.webContents.executeJavaScript(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}),r=b.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});await win.webContents.executeJavaScript('new Promise(r=>setTimeout(r,150))');};
 await click('[data-demo-tab="queue"]');if(!await win.webContents.executeJavaScript(`document.querySelector('#demo-content').textContent.includes('PLAYING')`))throw Error('Demo tab hit testing failed');
 await click('.demo-queue-row button');if(!await win.webContents.executeJavaScript(`document.querySelector('.demo-queue-row button').textContent.includes('3 / 3')`))throw Error('Demo counter failed');
 await click('[data-demo-tab="themes"]');await click('.demo-theme-grid button:nth-child(2)');if(!await win.webContents.executeJavaScript(`document.querySelector('.demo-theme-grid .selected').textContent.includes('サクラ')`))throw Error('Theme preview failed');
 win.setContentSize(390,844);await win.webContents.executeJavaScript('new Promise(r=>setTimeout(r,250))');
 if(await win.webContents.executeJavaScript('document.documentElement.scrollWidth>innerWidth+1'))throw Error('Mobile horizontal overflow');
 writeFileSync(resolve('.smoke-data/site-mobile.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 console.log('SITE SMOKE OK',JSON.stringify(state));win.destroy();clearTimeout(timer);app.quit();
}catch(error){console.error(error);clearTimeout(timer);app.exit(1);}
});






