import brandIcon from './assets/castpanel-icon.png';
import { ThemeEditor } from './ThemeEditor';
import { fonts } from '../shared/custom-themes';
import { panelNames,type Panel } from '../shared/windows';
const detachedPanel=new URLSearchParams(location.search).get('panel');
import { themeIds,themeNames,palettes } from '../shared/themes';
import { useEffect,useRef,useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DesktopAPI,Settings,Snapshot } from '../shared/types';
import type { StudioCommand } from '../shared/studio';
import { TTSManager } from './tts';
import { StudioPanels,type Run } from './panels';
import { ConnectionTable } from './ConnectionTable';
import { CommentLane } from './CommentLane';
import { Listeners,Profile,SettingsPanel } from './ManagementPanels';
import './style.css';
import { SpeechOptionsDialog } from './SpeechOptionsDialog';

declare global {interface Window {castpanel:DesktopAPI}}
const tabs=[['timeline','コメント'],['listeners','電子名簿'],['participation','参加型'],['poll','投票・クイズ'],['stocks','ストック'],['templates','OBS'],['setlist','曲・時刻'],['effects','演出'],['logs','ログ解析'],['tester','テスター'],['backup','バックアップ'],['integrations','連携・拡張'],['remote','リモート'],['themes','テーマ編集'],['settings','設定']];
const descriptions:Record<string,string>={listeners:'リスナーの記録・ニックネーム・メモ',participation:'参加待ちの受付と順番を管理',poll:'コメントで集めるアンケート・クイズ',templates:'OBSブラウザソースの表示を設定',setlist:'曲順と配信中のハイライトを記録',effects:'コメントに反応する演出を設定',logs:'保存したコメントを検索・集計',tester:'配信に接続せずに表示や動作を確認',backup:'設定と名簿のバックアップ・復元',integrations:'音声・翻訳・外部ツールと接続',remote:'同じLANの別端末にコメントを表示',settings:'フィルター・辞書・音声・アプリ更新'};
function readWidth(){try{const value=Number(localStorage.getItem('castpanel.giftWidth'));return value>=240&&value<=480?value:320;}catch{return 320;}}
function App(){
 const [state,setState]=useState<Snapshot>();const [draft,setDraft]=useState<Settings>();
 const [notice,setNotice]=useState<{text:string;error?:boolean}>();const [tab,setTab]=useState(detachedPanel&&detachedPanel in panelNames?detachedPanel:'timeline');const [selected,setSelected]=useState<{key:string;name:string}>();
 const [speechConnectionId,setSpeechConnectionId]=useState<string>();
 const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem('castpanel.sourcesCollapsed')==='true';}catch{return false;}});const [pending,setPending]=useState(0);const [fontSize,setFontSize]=useState(()=>{try{const n=Number(localStorage.getItem('castpanel.fontSize'));return [14,16,18,20].includes(n)?n:16;}catch{return 16;}});
 const [giftVisible,setGiftVisible]=useState(()=>{try{return localStorage.getItem('castpanel.giftPanel')!=='hidden';}catch{return true;}});const [giftWidth,setGiftWidth]=useState(readWidth);
 const draftRef=useRef<Settings|undefined>(undefined);const persistedRef=useRef<Settings|undefined>(undefined);const feedArea=useRef<HTMLDivElement>(null);const dialog=useRef<HTMLDialogElement>(null);
 const seen=useRef(new Set<string>());const tts=useRef<TTSManager|null>(null);if(!tts.current)tts.current=new TTSManager(text=>setNotice({text,error:true}));
 const updateDraft=(value:Settings)=>{draftRef.current=value;setDraft(value);};
 const run:Run=async(operation,message)=>{try{await operation();if(message)setNotice({text:message});}catch(error){setNotice({text:String(error),error:true});}};
 const save=async(next=draftRef.current)=>{
  if(!next)return;setPending(count=>count+1);
  try{await window.castpanel.save(next);const saved=(await window.castpanel.snapshot()).settings;if(draftRef.current===next)updateDraft(saved);setNotice({text:'設定を保存しました'});return true;}catch(error){setNotice({text:String(error),error:true});return false;}finally{setPending(count=>count-1);}
 };
 useEffect(()=>{
  let initialized=false;
  const accept=(snapshot:Snapshot)=>{
   setState(snapshot);if(!draftRef.current||persistedRef.current&&JSON.stringify(draftRef.current)===JSON.stringify(persistedRef.current))updateDraft(snapshot.settings);persistedRef.current=snapshot.settings;
   if(!detachedPanel){tts.current!.configure(snapshot.settings);tts.current!.setEligibility((id,key)=>!!snapshot.settings.connections.find(c=>c.id===id)?.tts&&!snapshot.studio.profiles[key]?.muted&&!snapshot.studio.profiles[key]?.blocked);}
   for(const comment of snapshot.comments){const key=`${comment.platform}:${comment.userId}`;const profile=snapshot.studio.profiles[key];if(!detachedPanel&&initialized&&!seen.current.has(comment.id)&&snapshot.settings.connections.find(c=>c.id===comment.connectionId)?.tts&&!profile?.muted&&!profile?.blocked)tts.current!.enqueue(comment.text,snapshot.settings,comment.connectionId,key,profile?.nickname||comment.username);seen.current.add(comment.id);}
   if(seen.current.size>2000)seen.current=new Set(snapshot.comments.map(c=>c.id));initialized=true;
  };
  const resetLayout=()=>{for(const key of ['castpanel.giftPanel','castpanel.giftWidth','castpanel.fontSize','castpanel.sourcesCollapsed'])try{localStorage.removeItem(key);}catch{}setGiftVisible(true);setGiftWidth(320);setFontSize(16);setCollapsed(false);};window.addEventListener('layout-reset',resetLayout);
  const off=window.castpanel.subscribe(accept);void window.castpanel.snapshot().then(accept).catch(error=>setNotice({text:String(error),error:true}));
  const closeMenus=(event:PointerEvent|KeyboardEvent)=>{if(event instanceof KeyboardEvent&&event.key!=='Escape')return;const target=event.target as HTMLElement;for(const menu of document.querySelectorAll<HTMLDetailsElement>('.tools-menu[open],.add-connection[open]'))if(event instanceof KeyboardEvent||!menu.contains(target))menu.open=false;};
  document.addEventListener('pointerdown',closeMenus);document.addEventListener('keydown',closeMenus);
  const restored=()=>{void window.castpanel.snapshot().then(snapshot=>{updateDraft(snapshot.settings);accept(snapshot);}).catch(error=>setNotice({text:String(error),error:true}));};window.addEventListener('settings-restored',restored);
  const keydown=(event:KeyboardEvent)=>{const element=event.target as HTMLElement;if(['INPUT','TEXTAREA','SELECT'].includes(element.tagName)||element.isContentEditable)return;if(event.ctrlKey&&event.shiftKey&&event.code==='KeyS'){event.preventDefault();tts.current!.stop();}if(event.ctrlKey&&event.shiftKey&&event.code==='KeyD'){event.preventDefault();void window.castpanel.demo().catch(error=>setNotice({text:String(error),error:true}));}if(event.ctrlKey&&event.shiftKey&&event.code==='KeyL'){event.preventDefault();setTab('logs');}};
  window.addEventListener('keydown',keydown);return()=>{window.removeEventListener('layout-reset',resetLayout);off();tts.current!.stop();window.removeEventListener('settings-restored',restored);window.removeEventListener('keydown',keydown);document.removeEventListener('pointerdown',closeMenus);document.removeEventListener('keydown',closeMenus);};
 },[]);
 useEffect(()=>{const custom=state?.settings.customThemes?.find(t=>t.id===state.settings.appCustomTheme);const p=custom||palettes[state?.settings.appTheme||'dark'];document.documentElement.style.setProperty('--user-radius',custom?custom.radius+'px':'7px');document.documentElement.style.setProperty('--user-border',custom?custom.borderWidth+'px':'1px');document.documentElement.style.fontFamily=custom?fonts[custom.font]:'';for(const [key,value] of Object.entries(p))document.documentElement.style.setProperty('--app-'+key,value);document.documentElement.dataset.appTheme=state?.settings.appTheme||'dark';},[state?.settings.appTheme,state?.settings.appCustomTheme,state?.settings.customThemes]);
 useEffect(()=>{document.querySelector('.tool-scroll')?.scrollTo(0,0);},[tab]);
 useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal();return()=>{dialog.current?.close();};},[selected?.key]);
 if(!state||!draft)return <div className="loading-screen">CastPanelを起動しています…{notice?.text}</div>;
 const command=(value:StudioCommand)=>run(()=>window.castpanel.command(value));
 const change=<K extends keyof Settings>(key:K,value:Settings[K])=>updateDraft({...draft,[key]:value});
 const dirty=JSON.stringify(draft)!==JSON.stringify(state.settings);
 const active=state.settings.connections.filter(c=>c.connect&&/接続中|監視中/.test(state.statuses[c.id]||'')).length;
 const commentsPage=tab==='timeline'||tab==='stocks';const title=tabs.find(([id])=>id===tab)?.[1]||'';
 const toggleGifts=()=>{const next=!giftVisible;setGiftVisible(next);try{localStorage.setItem('castpanel.giftPanel',next?'visible':'hidden');}catch{}};
 const persistWidth=(width:number)=>{setGiftWidth(width);try{localStorage.setItem('castpanel.giftWidth',String(width));}catch{}};
 return <div className={`app-shell ${detachedPanel?'detached-panel':''}`}>
  <header className="app-header"><div className="app-brand"><img className="brand-icon" src={brandIcon} alt=""/><h1>CastPanel</h1><span className="brand-caption">COMMENT VIEWER</span></div><span className={`header-status ${active?'online':''}`}><i/>{active?`${active}枠 受信中`:'接続待機'}</span><div className="header-actions"><button className="button subtle" onClick={()=>{tts.current!.stop();setNotice({text:'読み上げを停止しました'});}}>Ⅱ 読み上げ停止</button><button className="button primary" disabled={!dirty||pending>0} onClick={()=>void save()}>{pending>0?'適用中…':dirty?'変更を保存':'保存済み'}</button><label className="app-theme-picker">外観<select aria-label="アプリテーマ" value={draft.appCustomTheme?'custom:'+draft.appCustomTheme:draft.appTheme||'dark'} onChange={event=>{const value=event.target.value;const next={...draft,appCustomTheme:value.startsWith('custom:')?value.slice(7):'',appTheme:value.startsWith('custom:')?draft.appTheme:value as Settings['theme']};updateDraft(next);void save(next);}}>{themeIds.map(id=><option key={id} value={id}>{themeNames[id]}</option>)}{draft.customThemes?.map(t=><option key={t.id} value={'custom:'+t.id}>{t.name}</option>)}</select></label><nav aria-label="アプリ設定"><button onClick={()=>setTab('themes')}>テーマ編集</button><button className={`icon-button ${tab==='settings'?'is-active':''}`} title="設定" onClick={()=>setTab('settings')}>設定</button></nav></div></header>
  <ConnectionTable draft={draft} state={state} collapsed={collapsed} onCollapse={()=>{setCollapsed(!collapsed);try{localStorage.setItem('castpanel.sourcesCollapsed',String(!collapsed));}catch{}}} onChange={updateDraft} onSave={next=>void save(next)} onLogin={id=>void run(()=>window.castpanel.login(id))} onSpeech={setSpeechConnectionId}/>
  <nav className="workspace-nav" aria-label="機能メニュー">{tabs.slice(0,6).map(([id,label])=><button data-view={id} key={id} aria-current={tab===id?'page':undefined} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}<details className="tools-menu"><summary className={tabs.slice(6).some(([id])=>id===tab)?'active':''}>その他 <span aria-hidden="true">▾</span></summary><div className="dropdown-menu">{tabs.slice(6).map(([id,label])=><button data-view={id} key={id} aria-current={tab===id?'page':undefined} onClick={event=>{setTab(id);event.currentTarget.closest('details')?.removeAttribute('open');}}>{label}<small>{descriptions[id]}</small></button>)}</div></details><span className="nav-spacer"/><button className="obs-copy" disabled={!state.overlayUrl} onClick={()=>void run(()=>navigator.clipboard.writeText(state.overlayUrl),'OBS用URLをコピーしました')}>↗ OBS URLをコピー</button></nav>
  {commentsPage?<main className="feed-workspace">
   <div className="feed-toolbar"><div><strong>{title}</strong><span className="muted">{tab==='stocks'?state.studio.stocks.length:state.comments.length}件</span></div><span className="toolbar-hint">新着コメントを自動表示</span><div className="toolbar-actions"><button className="button compact subtle" onClick={()=>void run(()=>window.castpanel.popout(tab==='stocks'?'stocks':'timeline'))}>↗ 別ウィンドウ</button>{detachedPanel&&<button onClick={e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));void run(()=>window.castpanel.pinWindow(on));}}>最前面</button>}<label className="font-control">文字<select aria-label="コメントの文字サイズ" value={fontSize} onChange={event=>{setFontSize(Number(event.target.value));try{localStorage.setItem('castpanel.fontSize',event.target.value);}catch{}}}>{[14,16,18,20].map(size=><option value={size} key={size}>{size}px</option>)}</select></label><button className="button compact subtle" aria-pressed={state.studio.split} onClick={()=>void command({type:'split',value:!state.studio.split})}>{state.studio.split?'1列表示':'2列表示'}</button>{tab==='timeline'&&<button className="button compact subtle" aria-pressed={giftVisible} onClick={toggleGifts}>{giftVisible?'ギフト欄を隠す':'ギフト欄を表示'}</button>}{tab==='stocks'?<button className="button compact subtle" onClick={()=>void run(()=>window.castpanel.exportData('stocks'))}>書き出し</button>:<button className="button compact subtle" onClick={()=>void command({type:'clear'})}>クリア</button>}</div></div>
   {state.studio.pinned&&<div className="pinned-strip"><span>固定</span><strong>{state.studio.profiles[`${state.studio.pinned.platform}:${state.studio.pinned.userId}`]?.nickname||state.studio.pinned.username}</strong><p>{state.studio.pinned.text}</p><button className="icon-button" aria-label="固定を解除" onClick={()=>void command({type:'pin',id:null})}>×</button></div>}
   <div className="feed-columns" ref={feedArea}><div className={`comment-columns ${state.studio.split?'split':''}`}><CommentLane title={tab==='stocks'?'ストック':'コメント'} state={state} stock={tab==='stocks'} fontSize={fontSize} command={command} select={setSelected} onTester={()=>setTab('tester')}/>{state.studio.split&&<CommentLane title="コメント 2" state={state} stock={tab==='stocks'} fontSize={fontSize} command={command} select={setSelected} onTester={()=>setTab('tester')}/>}</div>
    {tab==='timeline'&&giftVisible&&<><div className="lane-resizer" role="separator" aria-label="ギフト欄の幅" aria-orientation="vertical" aria-valuenow={giftWidth} aria-valuemin={240} aria-valuemax={480} tabIndex={0} onPointerDown={event=>event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId)&&feedArea.current)setGiftWidth(Math.round(Math.max(240,Math.min(480,feedArea.current.getBoundingClientRect().right-event.clientX))));}} onPointerUp={event=>{event.currentTarget.releasePointerCapture(event.pointerId);persistWidth(giftWidth);}} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();persistWidth(Math.max(240,Math.min(480,giftWidth+(event.key==='ArrowLeft'?16:-16))));}}}/><div className="gift-column" style={{width:giftWidth}}><CommentLane title="ギフト・スパチャ" state={state} gift fontSize={fontSize} command={command} select={setSelected} onTester={()=>setTab('tester')}/></div></>}
   </div>
  </main>:<main className="tool-workspace"><div className="tool-heading"><div><h2>{title}</h2><p>{descriptions[tab]}</p></div><div className="tool-heading-actions">{tab in panelNames&&<button className="button compact" onClick={()=>void run(()=>window.castpanel.popout(tab as Panel))}>↗ 別ウィンドウ</button>}{detachedPanel&&<button className="button compact" onClick={e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));void run(()=>window.castpanel.pinWindow(on));}}>最前面</button>}{tab==='templates'&&<label className="theme-control">テーマ<select aria-label="OBSテーマ" value={draft.obsCustomTheme?'custom:'+draft.obsCustomTheme:draft.theme} onChange={event=>{const value=event.target.value;const next={...draft,obsCustomTheme:value.startsWith('custom:')?value.slice(7):'',theme:value.startsWith('custom:')?draft.theme:value as Settings['theme']};updateDraft(next);void save(next);}}>{themeIds.map(theme=><option value={theme} key={theme}>{themeNames[theme]}</option>)}{draft.customThemes?.map(t=><option key={t.id} value={'custom:'+t.id}>{t.name}</option>)}</select></label>}<button className="button compact" onClick={()=>setTab('timeline')}>コメントへ戻る</button></div></div><div className="tool-scroll"><div className={`tool-content ${tab==='listeners'?'wide':''}`}>
   {tab==='themes'&&<ThemeEditor state={state}/>} {tab==='listeners'&&<Listeners state={state} select={setSelected} run={run}/>}
   {tab==='settings'&&<SettingsPanel draft={draft} change={change} state={state} run={run}/>}
   <StudioPanels key={tab} tab={tab} state={state} run={run}/>
  </div></div></main>}
  <footer className={`status-bar ${notice?.error?'has-error':''}`}><span className="status-message" role="status">{notice?.text||state.statuses.overlay||'接続先を入力して接続をONにしてください。スイッチの変更は自動で保存します。'}</span>{notice&&<button aria-label="通知を閉じる" onClick={()=>setNotice(undefined)}>×</button>}<span className="status-divider"/><span>{pending>0?'設定を適用中':dirty?'未保存の変更あり':'設定保存済み'}</span><span className="footer-obs"><i className={state.statuses.overlay?'error-dot':''}/>OBS {state.overlayUrl?`:${new URL(state.overlayUrl).port}`:'未接続'}</span></footer>
  {speechConnectionId&&draft.connections.find(c=>c.id===speechConnectionId)&&<SpeechOptionsDialog key={speechConnectionId} connection={draft.connections.find(c=>c.id===speechConnectionId)!} settings={draft} close={()=>setSpeechConnectionId(undefined)} onSave={async speech=>{const next={...draft,connections:draft.connections.map(c=>c.id===speechConnectionId?{...c,speech}:c)};updateDraft(next);return save(next);}}/>}
  {selected&&<dialog ref={dialog} className="profile-dialog" aria-label="リスナー編集" onCancel={()=>setSelected(undefined)} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setSelected(undefined);}}}><Profile key={selected.key} selected={selected} state={state} command={command} close={()=>setSelected(undefined)}/></dialog>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);







