import { useState } from 'react';
import type { Connection,Settings,Snapshot } from '../shared/types';

export const platformNames={youtube:'YouTube',twitch:'Twitch',twitcasting:'ツイキャス'};
const platformMarks={youtube:'YT',twitch:'TW',twitcasting:'TC'};
type Props={
 draft:Settings;state:Snapshot;collapsed:boolean;onCollapse:()=>void;
 onChange:(settings:Settings)=>void;onSave:(settings:Settings)=>void;
 onLogin:(id:string)=>void;
 onSpeech:(id:string)=>void;
};
export function ConnectionTable({draft,state,collapsed,onCollapse,onChange,onSave,onLogin,onSpeech}:Props){
 const [focusId,setFocusId]=useState('');
 const [menuPosition,setMenuPosition]=useState({left:0,top:0});
 const edit=(id:string,patch:Partial<Connection>,save=false)=>{
  const next={...draft,connections:draft.connections.map(connection=>connection.id===id?{...connection,...patch}:connection)};
  onChange(next);if(save)onSave(next);
 };
 const add=(platform:Connection['platform'])=>{
  const id=crypto.randomUUID();const next={...draft,connections:[...draft.connections,{id,platform,target:'',connect:false,tts:false,tracking:true,export:false,overlay:true}]};
  setFocusId(id);onChange(next);onSave(next);
 };
 return <section className="connections" aria-label="配信の接続設定">
  <div className="connections-heading"><button className="section-toggle" onClick={onCollapse} aria-expanded={!collapsed}><span aria-hidden="true">{collapsed?'▸':'▾'}</span> 接続先 <span className="count-pill">{draft.connections.length}</span></button><span className="connections-help">URL・ユーザー名を入力して接続をON</span><details className="add-connection"><summary className="button compact">＋ 接続先を追加</summary><div className="dropdown-menu">{(['youtube','twitch','twitcasting'] as const).map(platform=><button key={platform} disabled={draft.connections.length>=20} onClick={event=>{add(platform);event.currentTarget.closest('details')?.removeAttribute('open');}}><span className="platform-mark" data-platform={platform}>{platformMarks[platform]}</span>{platformNames[platform]}</button>)}</div></details></div>
  {!collapsed&&<div className="connection-scroll"><div className="connection-table" role="table" aria-label="接続先と個別スイッチ">
   <div className="connection-grid connection-labels" role="row"><span role="columnheader">サービス</span><span role="columnheader">枠名</span><span role="columnheader">配信URL・ユーザー名</span><span role="columnheader">受信状態</span>{['接続','読み上げ','名簿','ログ','OBS'].map(label=><span className="switch-heading" role="columnheader" key={label}>{label}</span>)}<span role="columnheader" aria-label="操作"/></div>
   {draft.connections.map(connection=>{
    const status=state.statuses[connection.id]||'停止';const error=/エラー|失敗|Error|解決でき|指定して|未実装/.test(status);const connected=!error&&/接続中|監視中/.test(status);
    return <div className="connection-grid connection-row" role="row" key={connection.id} data-connection-row={connection.id}>
     <div role="cell" className="service-cell"><span className="platform-mark" data-platform={connection.platform}>{platformMarks[connection.platform]}</span><span>{platformNames[connection.platform]}</span></div>
     <div role="cell"><input aria-label={`${platformNames[connection.platform]} 枠名`} value={connection.name||''} placeholder="枠名（任意）" onChange={event=>edit(connection.id,{name:event.target.value})} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing)onSave(draft);}}/></div>
     <div role="cell"><input autoFocus={focusId===connection.id} aria-label={`${platformNames[connection.platform]} 接続先`} value={connection.target} placeholder={connection.platform==='youtube'?'https://www.youtube.com/watch?v=… / @ハンドル':'ユーザー名・配信URL'} onChange={event=>edit(connection.id,{target:event.target.value})} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing)onSave(draft);}}/></div>
     <div role="cell" className={`connection-status ${error?'is-error':connected?'is-connected':''}`} title={status}><span className="status-dot"/><span>{status}</span></div>
     {(['connect','tts','tracking','export','overlay'] as const).map((key,index)=><div role="cell" className="switch-cell" key={key}><label className="toggle" title={`${platformNames[connection.platform]} ${['接続','読み上げ','名簿記録','ログ出力','OBS出力'][index]}`}><input type="checkbox" role="switch" aria-label={`${connection.name||platformNames[connection.platform]} ${['接続','読み上げ','名簿記録','ログ出力','OBS出力'][index]}`} checked={key==='overlay'?connection.overlay!==false:connection[key]} onChange={event=>edit(connection.id,{[key]:event.target.checked},true)}/><span aria-hidden="true"/></label></div>)}
     <div role="cell"><button className="icon-button" popoverTarget={`connection-menu-${connection.id}`} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();setMenuPosition({left:Math.max(8,rect.right-230),top:rect.bottom+6});}} aria-label={`${connection.name||platformNames[connection.platform]} の操作`} title="接続先の操作">⋯</button><div id={`connection-menu-${connection.id}`} popover="auto" className="connection-popover" style={menuPosition}><button onClick={()=>{document.getElementById(`connection-menu-${connection.id}`)?.hidePopover();onLogin(connection.id);}}>サイトを開く・ログイン</button><button onClick={()=>{document.getElementById(`connection-menu-${connection.id}`)?.hidePopover();onSpeech(connection.id);}}>読み上げ設定</button><button className="danger-text" onClick={()=>{const next={...draft,connections:draft.connections.filter(item=>item.id!==connection.id)};onChange(next);onSave(next);}}>接続先を削除</button>{connection.platform==='twitcasting'&&<p className="muted">ツイキャス取得は試験実装です。</p>}</div></div>
    </div>;
   })}
   {!draft.connections.length&&<p className="connections-empty">「接続先を追加」から配信サービスを登録してください。</p>}
  </div></div>}
 </section>;
}

