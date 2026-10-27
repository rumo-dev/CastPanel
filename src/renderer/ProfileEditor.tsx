import { useState } from 'react';
import type { Snapshot } from '../shared/types';
import type { StudioCommand,UserProfile } from '../shared/studio';
import { Field } from './panels';
export function ProfileEditor({selected,state,command,close}:{selected:{key:string;name:string};state:Snapshot;command:(command:StudioCommand)=>Promise<void>;close:()=>void}){
 const listener=state.listeners[selected.key];
 const [profile,setProfile]=useState<UserProfile>(state.studio.profiles[selected.key]||{nickname:'',memo:'',muted:false,blocked:false});
 return <section className="space-y-4"><div className="flex justify-between"><h2>{listener?.username||selected.name}</h2><button onClick={close}>閉じる</button></div><p className="muted">{selected.key}</p>
  <Field label="ニックネーム"><input value={profile.nickname} onChange={event=>setProfile({...profile,nickname:event.target.value})}/></Field><Field label="メモ"><textarea rows={4} value={profile.memo} onChange={event=>setProfile({...profile,memo:event.target.value})}/></Field>
  <label className="block"><input type="checkbox" checked={profile.muted} onChange={event=>setProfile({...profile,muted:event.target.checked})}/> 読み上げミュート</label><label className="block"><input type="checkbox" checked={profile.blocked} onChange={event=>setProfile({...profile,blocked:event.target.checked})}/> このアプリ内でブロック</label>
  <Field label="アイコン利用の確認記録"><select value={profile.iconPermission||'unknown'} onChange={event=>setProfile({...profile,iconPermission:event.target.value as UserProfile['iconPermission']})}><option value="unknown">未確認</option><option value="allowed">本人への確認済み・利用可</option><option value="denied">利用不可</option></select></Field><p className="muted">確認結果を記録する項目です。この設定自体が権利者の許諾になるものではありません。</p>
  <button onClick={()=>void command({type:'profile',key:selected.key,profile})}>保存</button>
  <div className="border-t border-slate-700 pt-4"><h3>表示名の履歴</h3><p className="muted mt-1 mb-3">同じユーザーIDで観測した表示名を直近20件記録します。ニックネームの編集は履歴に含めません。</p>{listener?.nameHistory?.length?<ol className="name-history">{[...listener.nameHistory].reverse().map((entry,index)=><li key={`${entry.seenAt}:${index}`}><span>{entry.name}</span><time>{new Date(entry.seenAt).toLocaleString()}</time></li>)}</ol>:<p className="muted">履歴は次回コメント受信時から記録されます。</p>}</div>
  <p className="muted">配信サイト側のブロック・削除には影響しません。</p>
 </section>;
}
