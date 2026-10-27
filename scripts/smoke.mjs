import { createServer as createPortProbe } from 'node:net';
import { app, BrowserWindow } from 'electron';
import { mkdirSync,mkdtempSync,writeFileSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Isolate smoke checks from the user's saved connections and listener database.
mkdirSync(resolve('.smoke-data'), { recursive: true });
const data = mkdtempSync(resolve('.smoke-data/run-'));
app.setPath('userData', data);
// Keep the test server away from the user's OBS browser source.
const portProbe=createPortProbe();await new Promise(resolve=>portProbe.listen(0,'127.0.0.1',resolve));const testPort=portProbe.address().port;await new Promise(resolve=>portProbe.close(resolve));writeFileSync(resolve(data,'server-state.json'),JSON.stringify({port:testPort}));
const timeout = setTimeout(() => {
  console.error('SMOKE FAILED: startup timed out');
  app.exit(1);
}, 90000);
let mainChecked=false;
app.on('web-contents-created', (_, contents) => {
  if(mainChecked)return;mainChecked=true;
  contents.once('did-finish-load', async () => {
    try {
      const result = await contents.executeJavaScript(`(async () => {
        if (!window.castpanel) throw new Error('Preload API missing');
        const state = await window.castpanel.snapshot();
        for (let i = 0; i < 50 && !document.body.innerText.includes('CastPanel'); i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return { connections: state.settings.connections.length, title: document.title,overlayUrl:state.overlayUrl,
          rendered: document.body.innerText.includes('CastPanel') };
      })()`);
      if (result.connections !== 2 || !result.rendered) throw new Error(JSON.stringify(result));
      if(!result.overlayUrl)throw new Error('OBS server did not start');
      const overlayResponse=await fetch(result.overlayUrl);if(overlayResponse.status!==200||!(await overlayResponse.text()).includes('CastPanel OBS'))throw new Error('OBS URL is not served by CastPanel');
      const health=await (await fetch(new URL('/api/health',result.overlayUrl))).json();if(health.application!=='CastPanel')throw new Error('Unexpected OBS server');
      console.log('SMOKE OK:', JSON.stringify(result));
      const suite = await contents.executeJavaScript(`(async () => {
        const api=window.castpanel;const before=await api.snapshot();
        await api.save({...before.settings,connections:before.settings.connections.map(c=>({...c,connect:false,export:true}))});
        await api.command({type:'participation',enabled:true,joinWord:'参加希望',leaveWord:'辞退'});
        await api.command({type:'poll-create',title:'次の配信',options:['ゲーム','雑談'],correct:-1});
        const base={connectionId:before.settings.connections[0].id,username:'SmokeUser',userId:'smoke',giftLabel:''};
        await api.demo({...base,text:'参加希望',giftLabel:'¥1,000',amount:1000});
        await api.demo({...base,text:'1'});await api.demo({...base,text:'2'});
        const received=await api.snapshot();const first=received.comments[0];
        await api.command({type:'stock',id:first.id});await api.command({type:'pin',id:first.id});
        await api.command({type:'profile',key:'youtube:smoke',profile:{nickname:'スモークリスナー',memo:'テストメモ',blocked:false,muted:true}});
        await api.command({type:'split',value:true});
        const current=await api.snapshot();const logs=await api.logs({query:'SmokeUser',from:'',to:'',platform:''});
        if(current.studio.participation.queue.length!==1||Object.keys(current.studio.poll.votes).length!==1||current.studio.poll.votes['youtube:smoke']!==1||current.studio.stocks.length!==1||logs.total!==3)throw new Error('Studio pipeline regression');
        for(const label of ['参加型','投票・クイズ','曲・時刻','OBS','ログ解析','連携・拡張','リモート','設定','コメント']){
          const button=Array.from(document.querySelectorAll('nav button')).find(b=>b.dataset.view===({'参加型':'participation','投票・クイズ':'poll','曲・時刻':'setlist','OBS':'templates','ログ解析':'logs','連携・拡張':'integrations','リモート':'remote','設定':'settings','コメント':'timeline'})[label]);
          if(!button)throw new Error('Missing tab '+label);button.click();await new Promise(resolve=>setTimeout(resolve,50));
        }
        return {comments:current.comments.length,queue:current.studio.participation.queue.length,votes:Object.keys(current.studio.poll.votes).length,logs:logs.total};
      })()`);
      console.log('SMOKE OK: studio + IPC + logs:', JSON.stringify(suite));
      const obs=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
      await obs.loadURL(result.overlayUrl);
      const waitForOverlay=async text=>obs.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const end=Date.now()+5000;const check=()=>{if(document.querySelector('#feed')?.textContent.includes(${JSON.stringify(text)}))resolve(true);else if(Date.now()>end)reject(Error('OBS WebSocket update timed out'));else setTimeout(check,50);};check();})`);
      await waitForOverlay('参加希望');
      await contents.executeJavaScript(`(async()=>{const state=await window.castpanel.snapshot();await window.castpanel.demo({connectionId:state.settings.connections[0].id,username:'OBS確認',userId:'obs-check',text:'OBSリアルタイム確認',giftLabel:''});})()`);
      await waitForOverlay('OBSリアルタイム確認');
      console.log('SMOKE OK: OBS browser source HTML + live WebSocket:',result.overlayUrl);
      await contents.executeJavaScript(`document.querySelector('.connection-row input:not([type="checkbox"])').focus()`);
      await contents.insertText('メイン配信');
      await contents.executeJavaScript('new Promise(resolve=>setTimeout(resolve,80))');
      contents.sendInputEvent({type:'keyDown',keyCode:'Enter'});
      contents.sendInputEvent({type:'keyUp',keyCode:'Enter'});
      const layout=await contents.executeJavaScript(`(async()=>{
        const api=window.castpanel;const wait=()=>new Promise(resolve=>setTimeout(resolve,80));
        const eventually=async(check)=>{for(let i=0;i<50;i++){if(await check())return;await wait();}throw new Error('UI action timed out');};
        const state=await api.snapshot();
        const row=document.querySelector('.connection-row');const toggle=row.querySelectorAll('input[role="switch"]')[3];const previous=state.settings.connections[0].export;
        toggle.click();await eventually(async()=>((await api.snapshot()).settings.connections[0].export===!previous));
        await eventually(async()=>((await api.snapshot()).settings.connections[0].name==='メイン配信'));
        row.querySelector('button[popovertarget]').click();await wait();const menu=document.querySelector('.connection-popover:popover-open');if(!menu||menu.getBoundingClientRect().bottom>innerHeight)throw new Error('Connection menu is clipped');menu.hidePopover();
        await api.command({type:'split',value:false});await wait();
        const resize=document.querySelector('[role="separator"]');const original=Number(resize.getAttribute('aria-valuenow'));resize.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await wait();if(Number(resize.getAttribute('aria-valuenow'))<=original)throw new Error('Lane resize failed');resize.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await wait();
        Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='ギフト欄を隠す').click();await wait();if(document.querySelector('.gift-column'))throw new Error('Gift lane did not hide');Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='ギフト欄を表示').click();await wait();
        const first=document.querySelector('.comment-lane');first.querySelector('button[aria-expanded]').click();await wait();first.querySelector('input').focus();
        const author=first.querySelector('.name-button');author.click();await wait();if(!document.querySelector('dialog[open]'))throw new Error('Listener dialog did not open');document.querySelector('dialog button').click();await wait();
        if(document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1)throw new Error('Workspace overflows the window');
        return {autoSave:true,sourceMenu:true,giftLane:true,filter:true,dialog:true,viewport:[innerWidth,innerHeight]};
      })()`);
      await contents.insertText('no_matching_comment');
      await contents.executeJavaScript(`new Promise(resolve=>setTimeout(resolve,80)).then(()=>{const lane=document.querySelector('.comment-lane');if(lane.querySelectorAll('.comment-row').length)throw new Error('Comment filter failed');lane.querySelector('input').select();})`);
      contents.sendInputEvent({type:'keyDown',keyCode:'Backspace'});
      contents.sendInputEvent({type:'keyUp',keyCode:'Backspace'});
      await contents.executeJavaScript(`new Promise(resolve=>setTimeout(resolve,80)).then(()=>document.querySelector('.comment-lane button[aria-expanded]').click())`);
      await contents.executeJavaScript('new Promise(resolve=>setTimeout(resolve,100))');
      console.log('SMOKE OK: connection switches + new layout:',JSON.stringify(layout));
      writeFileSync(resolve('.smoke-data/ui.png'), (await contents.capturePage()).toPNG());
      const window=BrowserWindow.fromWebContents(contents);window.setContentSize(1000,700);
      await contents.executeJavaScript('new Promise(resolve=>setTimeout(resolve,100))');
      const small=await contents.executeJavaScript(`(()=>{const rect=document.querySelector('.comment-lane').getBoundingClientRect();const scroller=document.querySelector('.comment-scroll');return {width:innerWidth,height:innerHeight,laneHeight:rect.height,latestGap:scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1};})()`);
      if(small.overflow||small.laneHeight<200||small.latestGap>48)throw new Error('Small-window layout regression: '+JSON.stringify(small));
      writeFileSync(resolve('.smoke-data/ui-small.png'),(await contents.capturePage()).toPNG());
      console.log('SMOKE OK: small-window layout:',JSON.stringify(small));window.setContentSize(1384,837);
      const speechAndHistory=await contents.executeJavaScript(`(async()=>{
        const api=window.castpanel;const wait=()=>new Promise(resolve=>setTimeout(resolve,80));
        const until=async(check)=>{for(let i=0;i<50;i++){if(await check())return;await wait();}throw new Error('New feature UI timed out');};
        const row=document.querySelector('.connection-row');row.querySelector('button[popovertarget]').click();await wait();
        Array.from(document.querySelectorAll('.connection-popover:popover-open button')).find(b=>b.textContent==='読み上げ設定').click();await wait();
        const dialog=document.querySelector('.speech-dialog[open]');if(!dialog)throw new Error('Speech dialog missing');
        dialog.querySelector('input[type="checkbox"]').click();await wait();
        const selects=Array.from(dialog.querySelectorAll('select'));const priority=selects[selects.length-1];priority.value='4';priority.dispatchEvent(new Event('change',{bubbles:true}));await wait();
        Array.from(dialog.querySelectorAll('button')).find(b=>b.textContent==='この枠の設定を保存').click();
        await until(async()=>((await api.snapshot()).settings.connections[0].speech?.priority===4));await until(()=>!document.querySelector('.speech-dialog[open]'));
        const state=await api.snapshot();await api.demo({connectionId:state.settings.connections[0].id,username:'SmokeUser Renamed',userId:'smoke',text:'改名後のコメント',giftLabel:''});
        document.querySelector('.comment-lane .name-button').click();await wait();
        const profile=document.querySelector('dialog[open]');if(!profile||!profile.innerText.includes('SmokeUser')||!profile.innerText.includes('SmokeUser Renamed'))throw new Error('Name history not shown');
        const permission=profile.querySelector('select');permission.value='allowed';permission.dispatchEvent(new Event('change',{bubbles:true}));await wait();
        Array.from(profile.querySelectorAll('button')).find(b=>b.textContent==='保存').click();
        await until(async()=>((await api.snapshot()).studio.profiles['youtube:smoke'].iconPermission==='allowed'));
        profile.querySelector('button').click();await wait();
        const current=await api.snapshot();if(current.listeners['youtube:smoke'].nameHistory.length!==2)throw new Error('Name history not persisted');
        return {speechPriority:current.settings.connections[0].speech.priority,nameHistory:2,iconPermission:'allowed'};
      })()`);
      console.log('SMOKE OK: speech overrides + name history:',JSON.stringify(speechAndHistory));
      await contents.executeJavaScript(`(async()=>{document.querySelector('.connection-row button[popovertarget]').click();await new Promise(resolve=>setTimeout(resolve,50));Array.from(document.querySelectorAll('.connection-popover:popover-open button')).find(b=>b.textContent==='読み上げ設定').click();await new Promise(resolve=>setTimeout(resolve,100));})()`);
      writeFileSync(resolve('.smoke-data/speech-options.png'),(await contents.capturePage()).toPNG());
      await contents.executeJavaScript(`(async()=>{document.querySelector('.speech-dialog button').click();await new Promise(resolve=>setTimeout(resolve,50));document.querySelector('.comment-lane .name-button').click();await new Promise(resolve=>setTimeout(resolve,100));})()`);
      writeFileSync(resolve('.smoke-data/listener-history.png'),(await contents.capturePage()).toPNG());
      await contents.executeJavaScript(`document.querySelector('dialog[open] button').click()`);
      const expanded=await contents.executeJavaScript(`(async()=>{
        const api=window.castpanel;
        const initial=await api.snapshot();const connectionId=initial.settings.connections[0].id;
        await api.command({type:'poll-create',title:'自由回答テスト',mode:'free',options:[],correct:-1,answerPrefix:'!投票',durationSeconds:0});
        await api.demo({connectionId,username:'投票A',userId:'answer-a',text:'!投票 game',giftLabel:''});
        await api.demo({connectionId,username:'投票B',userId:'answer-b',text:'!投票 ゲーム',giftLabel:''});
        await api.command({type:'poll-merge',source:1,target:0});
        const merged=await api.snapshot();if(merged.studio.poll.options.length!==1||Object.keys(merged.studio.poll.votes).length!==2)throw new Error('Free-answer merge regression');
        await api.command({type:'setlist-add',title:'変更前の曲',artist:'A'});
        const song=(await api.snapshot()).studio.setlist[0];
        await api.command({type:'setlist-edit',id:song.id,title:'変更後の曲',artist:'B'});
        await api.command({type:'stream-time',startedAt:new Date(Date.now()-60000).toISOString()});
        await api.command({type:'timestamp',label:'開始'});
        const stamp=(await api.snapshot()).studio.timestamps[0];
        await api.command({type:'timestamp-edit',id:stamp.id,seconds:10,label:'変更済み'});
        await api.command({type:'poll-create',title:'自動締切テスト',options:['A','B'],correct:-1,durationSeconds:1});
        await new Promise(resolve=>setTimeout(resolve,1200));
        const ended=await api.snapshot();if(ended.studio.poll.active)throw new Error('Timer did not close poll without comments');
        if(ended.studio.setlist[0].title!=='変更後の曲'||ended.studio.timestamps[0].seconds!==10)throw new Error('Session edit regression');
        const first=Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent==='投票・クイズ');first.click();await new Promise(resolve=>setTimeout(resolve,150));
        if(!document.body.innerText.includes('自由回答')||!document.body.innerText.includes('過去の質問'))throw new Error('Poll UI not rendered');
        return {mergedVotes:2,autoClosed:true,history:ended.studio.pollHistory.length};
      })()`);
      console.log('SMOKE OK: free answers + deadline + session editing:',JSON.stringify(expanded));
      await contents.executeJavaScript(`(async()=>{const api=window.castpanel;const s=await api.snapshot();s.studio.overlay.layout.widgets.setlist.enabled=true;s.studio.overlay.layout.widgets.gifts.seconds=0;s.studio.overlay.layout.widgets.comments.seconds=0;await api.command({type:'overlay',overlay:s.studio.overlay});})()`);
      await obs.webContents.executeJavaScript('new Promise(resolve=>setTimeout(resolve,150))');
      const allViews=await obs.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-view]')).map(section=>section.dataset.view)`);
      for(const view of ['comments','gifts','pinned','queue','poll','setlist'])if(!allViews.includes(view))throw new Error('All overlay missing '+view);
      obs.setContentSize(1200,900);await obs.webContents.executeJavaScript('new Promise(resolve=>setTimeout(resolve,80))');
      writeFileSync(resolve('.smoke-data/overlay-all.png'),(await obs.webContents.capturePage()).toPNG());
      const drag=await contents.executeJavaScript(`(async()=>{document.querySelector('nav button[data-view="templates"]').click();await new Promise(r=>setTimeout(r,100));const e=document.querySelector('[aria-label="コメントを配置"]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:Math.round(r.x+30),y:Math.round(r.y+15),before:(await window.castpanel.snapshot()).studio.overlay.layout.widgets.comments.x};})()`);
      contents.sendInputEvent({type:'mouseMove',x:drag.x,y:drag.y});contents.sendInputEvent({type:'mouseDown',x:drag.x,y:drag.y,button:'left',clickCount:1});contents.sendInputEvent({type:'mouseMove',x:drag.x-35,y:drag.y});contents.sendInputEvent({type:'mouseUp',x:drag.x-35,y:drag.y,button:'left',clickCount:1});
      await contents.executeJavaScript(`new Promise(r=>setTimeout(r,100))`);
      await contents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('保存してOBSに反映')).click()`);
      await contents.executeJavaScript(`new Promise(r=>setTimeout(r,150))`);
      const after=await contents.executeJavaScript(`(async()=> (await window.castpanel.snapshot()).studio.overlay.layout.widgets.comments.x)()`);
      if(!(after<drag.before))throw Error('Layout drag/save failed: '+JSON.stringify({drag,after}));
      const overlayX=await obs.webContents.executeJavaScript(`parseFloat(document.querySelector('[data-view="comments"]').style.left)`);
      if(Math.abs(overlayX-after)>.01)throw Error('OBS layout did not synchronize');
      writeFileSync(resolve('.smoke-data/overlay-editor.png'),(await contents.capturePage()).toPNG());
      await obs.webContents.executeJavaScript(`state.comments.forEach(c=>c.timestamp=new Date(Date.now()-100000).toISOString());state.overlay.layout.widgets.comments.seconds=1;state.overlay.layout.widgets.gifts.seconds=1;state.poll.endedAt=new Date(Date.now()-100000).toISOString();render();if(document.querySelector('[data-view="comments"],[data-view="gifts"],[data-view="poll"]'))throw Error('Expired widgets remain visible');if(!document.querySelector('[data-view="pinned"]'))throw Error('Pinned comment unexpectedly expired');`);
      console.log('SMOKE OK: layout drag + save + OBS synchronization + expiry');
      const commentsUrl=new URL(result.overlayUrl);commentsUrl.searchParams.set('view','comments');await obs.loadURL(commentsUrl.href);await waitForOverlay('OBSリアルタイム確認');
      if(await obs.webContents.executeJavaScript(`!!document.querySelector('.all-grid,[data-view="poll"],[data-view="setlist"]')`))throw new Error('Comments-only overlay includes other widgets');
      console.log('SMOKE OK: root overlay shows all widgets; comments view stays separate');
      writeFileSync(resolve('.smoke-data/poll.png'),(await contents.capturePage()).toPNG());
      const queueCheck=await contents.executeJavaScript(`(async()=>{const api=window.castpanel;let s=await api.snapshot();await api.command({type:'queue-config',config:{...s.studio.participation.config,slots:1,limit:2}});await api.command({type:'queue-action',action:'plus-all'});await api.command({type:'queue-action',action:'plus-all'});await api.command({type:'queue-appearance',appearance:{...s.studio.participation.appearance,useGlobalTheme:false,theme:'neon',layout:'cards'}});await api.save({...s.settings,appTheme:'sakura'});document.querySelector('nav button[data-view="participation"]').click();await new Promise(r=>setTimeout(r,150));if(!document.body.innerText.includes('全員 ＋1')||!document.body.innerText.includes('連続回数'))throw Error('Queue controls missing');if(document.documentElement.dataset.appTheme!=='sakura')throw Error('Application palette not applied');const form=document.querySelector('.participation-panel form.item');if(getComputedStyle(form).backgroundColor!=='rgb(255, 250, 253)'||getComputedStyle(form.querySelector('select')).backgroundColor!=='rgb(255, 240, 244)')throw Error('Light theme has a dark form background');return {count:(await api.snapshot()).studio.participation.queue[0].plays};})()`);
      if(queueCheck.count!==2)throw Error('Queue count not synchronized');
      writeFileSync(resolve('.smoke-data/participation.png'),(await contents.capturePage()).toPNG());
      const qUrl=new URL('/sanka/overlay',result.overlayUrl);await obs.loadURL(qUrl.href);await obs.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let tries=0;const check=()=>{if(document.querySelector('#root[data-layout=cards] .it.limit'))resolve(true);else if(++tries>60)reject(Error('Queue OBS style or count missing'));else setTimeout(check,50);};check();})`);
      writeFileSync(resolve('.smoke-data/queue-overlay.png'),(await obs.webContents.capturePage()).toPNG());
      for(const style of ['list','cards','chips','bar','spotlight']){qUrl.searchParams.set('layout',style==='bar'?'line':style);qUrl.searchParams.set('theme','mint');await obs.loadURL(qUrl.href);await obs.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let tries=0;const check=()=>{if(document.querySelector('#root[data-layout="${style==='bar'?'line':style}"]'))resolve(true);else if(++tries>60)reject(Error('Queue URL override failed'));else setTimeout(check,20);};check();})`);}
      const dockWindow=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});const control=await contents.executeJavaScript(`window.castpanel.snapshot().then(s=>s.controlToken)`);await dockWindow.loadURL(new URL('/queue-control#'+control,result.overlayUrl).href);await dockWindow.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let tries=0;const check=()=>{if(document.querySelector('#queue li'))resolve(true);else if(++tries>60)reject(Error('OBS dock not connected'));else setTimeout(check,30);};check();})`);await dockWindow.webContents.executeJavaScript(`document.querySelector('#buttons button').click();new Promise(r=>setTimeout(r,100))`);const dockCount=await contents.executeJavaScript(`window.castpanel.snapshot().then(s=>s.studio.participation.queue[0].plays)`);if(dockCount!==3)throw Error('Authenticated dock command failed');await dockWindow.webContents.executeJavaScript(`location.reload()`);await new Promise(r=>setTimeout(r,200));const hash=await dockWindow.webContents.executeJavaScript(`location.hash`);if(hash.length<2)throw Error('Dock reload lost authentication');dockWindow.close();
      await contents.executeJavaScript(`(async()=>{await window.castpanel.command({type:'queue-action',action:'undo'});const s=await window.castpanel.snapshot();await window.castpanel.save({...s.settings,appTheme:'dark'});})()`);
      console.log('SMOKE OK: participation counters + app theme + five OBS styles + authenticated OBS dock');
      await contents.executeJavaScript(`window.castpanel.popout('participation')`);
      const full=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/vendor/sanka/renderer/index.html'));
      if(!full)throw Error('Full participation window did not open');
      const fullResult=await full.webContents.executeJavaScript(`(async()=>{if(!window.api)throw Error('Full preload missing');const state=await api.getState();if(state.queue.length!==1)throw Error('Full queue is not shared');document.querySelector('[data-pane="pane-cards"]').click();await new Promise(r=>setTimeout(r,100));if(!document.querySelector('#cards').textContent.includes('新規'))throw Error('Full card designer missing');const data=new Uint8Array(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1kAAAAASUVORK5CYII=').split('').map(c=>c.charCodeAt(0)));const asset=await api.addAsset('pixel.png',data);let unsafe=false;try{await api.addAsset('script.svg',new TextEncoder().encode('<svg><script>alert(1)</script></svg>'));}catch{unsafe=true;}if(!unsafe)throw Error('Unsafe SVG accepted');const design=structuredClone(CARD.BUILTIN[1]);design.id='';design.title='統合カード確認';design.bg.image=asset;const id=await api.saveDesign(design,true);await api.action({type:'plus1All'});await api.action({type:'undo'});return {id,asset,queue:(await api.getState()).queue.length};})()`);
      const fullSaved=await contents.executeJavaScript(`window.castpanel.snapshot().then(s=>s.studio.fullParticipation)`);
      if(!fullSaved.designs.some(d=>d.id===fullResult.id)||fullSaved.settings.overlay.layout!=='rich')throw Error('Full card state was not persisted in shared storage');
      const fullUrl=new URL('/sanka/overlay',result.overlayUrl);await obs.loadURL(fullUrl.href);await obs.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let count=0;const check=()=>{if(document.querySelector('#root[data-layout=rich] .card'))resolve(true);else if(count++>80)reject(Error('Rich card not rendered in OBS'));else setTimeout(check,30);};check();})`);
      const assetResponse=await fetch(new URL('/sanka/user/'+fullResult.asset,result.overlayUrl));if(!assetResponse.ok)throw Error('Imported asset not served');
      await full.webContents.executeJavaScript(`document.querySelector('[data-pane="pane-design"]').click();new Promise(r=>setTimeout(r,200))`);
      const previewFrame=full.webContents.mainFrame.frames.find(f=>f.url.includes('/sanka/overlay?demo=1'));if(!previewFrame)throw Error('Full preview iframe blocked');await previewFrame.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const check=()=>{if(document.querySelector('#root .card'))resolve(true);else if(n++>80)reject(Error('Full preview did not render'));else setTimeout(check,30);};check();})`);
      const fullPublic=await (await fetch(new URL('/api/state',result.overlayUrl))).json();if(JSON.stringify(fullPublic).includes('token')||'fullParticipation' in fullPublic)throw Error('Full private state leaked to OBS');
      await full.webContents.executeJavaScript(`document.querySelector('[data-pane="pane-cards"]').click()`);
      writeFileSync(resolve('.smoke-data/full-participation.png'),(await full.webContents.capturePage()).toPNG());
      await full.webContents.executeJavaScript(`api.setMini(true)`);if(!full.isAlwaysOnTop()||full.getBounds().width!==400)throw Error('Mini mode failed');await full.webContents.executeJavaScript(`api.setMini(false)`);
      await contents.executeJavaScript(`window.castpanel.popout('effects')`);const effectsWindow=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('panel=effects'));if(!effectsWindow)throw Error('Effects popout missing');await effectsWindow.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const check=()=>{if(document.querySelector('.detached-panel'))resolve(true);else if(n++>80)reject(Error('Detached renderer missing'));else setTimeout(check,30);};check();})`);await effectsWindow.webContents.executeJavaScript(`window.castpanel.command({type:'rules',rules:[{id:'popup-check',word:'popup',message:'同期済み',cooldown:0,enabled:true}]})`);if(!(await contents.executeJavaScript(`window.castpanel.snapshot().then(s=>s.studio.rules.some(r=>r.id==='popup-check'))`)))throw Error('Popout command did not reach main state');effectsWindow.close();
      await contents.executeJavaScript(`document.querySelector('nav button[data-view="themes"]').click();new Promise(r=>setTimeout(r,150))`);
      await contents.executeJavaScript(`(()=>{const input=document.querySelector('input[maxlength="80"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'カスタム確認');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await contents.executeJavaScript(`new Promise(r=>setTimeout(r,60))`);await contents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存してアプリに適用').click();new Promise(r=>setTimeout(r,200))`);
      const themed=await contents.executeJavaScript(`window.castpanel.snapshot().then(s=>s.settings)`);if(!themed.appCustomTheme||!themed.customThemes.some(t=>t.name==='カスタム確認'))throw Error('Custom theme editor did not save');await contents.executeJavaScript(`window.castpanel.save({...${JSON.stringify(themed)},queueCustomTheme:${JSON.stringify(themed.appCustomTheme)},obsCustomTheme:${JSON.stringify(themed.appCustomTheme)}})`);
      const themeState=await full.webContents.executeJavaScript(`api.getState().then(s=>s.userTheme.name)`);if(themeState!=='カスタム確認')throw Error('Custom theme not synchronized to full window');writeFileSync(resolve('.smoke-data/theme-editor.png'),(await contents.capturePage()).toPNG());
      console.log('SMOKE OK: full card designer + imported image + rich OBS + mini + detached effects + custom theme editor');
      const fallback=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,partition:'http-fallback-test'}});fallback.webContents.session.webRequest.onBeforeRequest({urls:['ws://*/*']},(_request,callback)=>callback({cancel:true}));await fallback.loadURL(result.overlayUrl);await fallback.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const check=()=>{if(document.querySelector('[data-view="comments"] .comment'))resolve(true);else if(n++>100)reject(Error('HTTP comment fallback failed'));else setTimeout(check,30);};check();})`);await fallback.loadURL(new URL('/sanka/overlay',result.overlayUrl).href);await fallback.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const check=()=>{if(document.querySelector('#root .card'))resolve(true);else if(n++>100)reject(Error('HTTP participation fallback failed'));else setTimeout(check,30);};check();})`);fallback.close();console.log('SMOKE OK: comments + participation render with WebSocket unavailable');
      const restored=await contents.executeJavaScript(`(async()=>{const api=window.castpanel;const name=await api.backup();await api.command({type:'clear'});await api.restore(name);const state=await api.snapshot();return state.studio.stocks.length===1&&state.studio.participation.queue.length===1&&state.settings.connections.every(c=>!c.connect)&&state.studio.pollHistory.some(p=>p.mode==='free'&&Object.keys(p.votes).length===2)&&state.studio.timestamps[0].seconds===10&&state.settings.connections[0].speech.priority===4&&state.listeners['youtube:smoke'].nameHistory.length===2&&state.studio.profiles['youtube:smoke'].iconPermission==='allowed';})()`);
      if(!restored)throw new Error('Backup/restore regression');
      console.log('SMOKE OK: backup + restore');
      const main = BrowserWindow.fromWebContents(contents);
      if (!main) throw new Error('Main window missing');
      // Reproduce a hidden YouTube window keeping window-all-closed from firing.
      const hidden = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
      const expectedBounds=main.getNormalBounds();
      app.once('quit', () => {
        clearTimeout(timeout);
        if (!hidden.isDestroyed()) {
          console.error('SMOKE FAILED: hidden window survived shutdown');
          process.exitCode = 1;
        } else console.log('SMOKE OK: main-window close shuts down hidden windows and exits');
        const saved=JSON.parse(readFileSync(resolve(data,'window-state.json'),'utf8')).placement;
        if(['x','y','width','height'].some(key=>saved[key]!==expectedBounds[key])){console.error('SMOKE FAILED: window placement not saved');process.exitCode=1;}else console.log('SMOKE OK: window placement saved');
      });
      main.close();
    } catch (error) {
      console.error('SMOKE FAILED:', error);
      app.exit(1);
    }
  });
});
await import(pathToFileURL(resolve('dist/main/main.js')).href);












