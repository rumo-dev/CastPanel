import { overlayViewUrl } from '../shared/overlay-url';
import { useEffect,useState } from 'react';
import type { Snapshot } from '../shared/types';
import type { Studio,StudioCommand } from '../shared/studio';
import { formatTimestamp } from '../shared/poll';
import type { Run } from './panels';
type Command=(command:StudioCommand)=>Promise<void>;
export function SessionPanel({state,command,run}:{state:Snapshot;command:Command;run:Run}){
 const [title,setTitle]=useState('');const [artist,setArtist]=useState('');const [label,setLabel]=useState('');const [startedAt,setStartedAt]=useState('');
 return <section className="space-y-5"><h2>セットリスト・タイムスタンプ</h2>
  <div className="grid grid-cols-2 gap-3"><label>曲名<input value={title} onChange={event=>setTitle(event.target.value)}/></label><label>アーティスト<input value={artist} onChange={event=>setArtist(event.target.value)}/></label></div>
  <button onClick={()=>void command({type:'setlist-add',title,artist})}>曲を追加</button>
  {state.studio.setlist.map((song,index)=><SongEditor key={song.id} song={song} index={index} command={command}/>)}
  <button onClick={()=>void run(()=>window.castpanel.exportData('setlist'))}>セットリストを書き出す</button><p className="muted select-all">{state.overlayUrl?overlayViewUrl(state.overlayUrl,'setlist'):'OBSサーバー未接続'}</p><hr/>
  <h3>配信開始時刻</h3><button onClick={()=>void command({type:'stream-start'})}>現在時刻を配信開始に設定</button><p className="muted">配信開始: {state.studio.streamStartedAt?new Date(state.studio.streamStartedAt).toLocaleString():'未設定'}</p>
  <label className="block">開始時刻を手動指定（この端末の現地時刻）<input type="datetime-local" value={startedAt} onChange={event=>setStartedAt(event.target.value)}/></label><button disabled={!startedAt} onClick={()=>void run(async()=>{const date=new Date(startedAt);if(!Number.isFinite(date.getTime()))throw Error('正しい開始時刻を指定してください');await window.castpanel.command({type:'stream-time',startedAt:date.toISOString()});})}>指定した開始時刻を保存</button><p className="muted">開始時刻の変更後も、既に記録したタイムスタンプの相対時刻は保持します。</p>
  <label className="block">タイムスタンプの見出し<input value={label} onChange={event=>setLabel(event.target.value)}/></label><button onClick={()=>void command({type:'timestamp',label})}>現在位置を記録</button> <button onClick={()=>void run(()=>window.castpanel.exportData('timestamps'))}>タイムスタンプを書き出す</button>
  {[...state.studio.timestamps].sort((a,b)=>a.seconds-b.seconds).map(stamp=><TimestampEditor key={stamp.id} stamp={stamp} command={command}/>)}
 </section>;
}
function SongEditor({song,index,command}:{song:Studio['setlist'][number];index:number;command:Command}){
 const [editing,setEditing]=useState(false);const [title,setTitle]=useState(song.title);const [artist,setArtist]=useState(song.artist);
 useEffect(()=>{setTitle(song.title);setArtist(song.artist);},[song.title,song.artist]);
 return <div className="item space-y-3"><div className="flex flex-wrap gap-2 items-center"><span className="flex-1">{song.done?'✓ ':''}{index+1}. {song.title} / {song.artist}</span>{(['up','down','done','remove'] as const).map((action,i)=><button key={action} onClick={()=>void command({type:'setlist-update',id:song.id,action})}>{['↑','↓','済／未','削除'][i]}</button>)}<button onClick={()=>setEditing(!editing)}>{editing?'編集を閉じる':'編集'}</button></div>{editing&&<div className="space-y-2"><label className="block">曲名<input value={title} onChange={event=>setTitle(event.target.value)}/></label><label className="block">アーティスト<input value={artist} onChange={event=>setArtist(event.target.value)}/></label><button onClick={()=>void command({type:'setlist-edit',id:song.id,title,artist})}>曲の変更を保存</button></div>}</div>;
}
function TimestampEditor({stamp,command}:{stamp:Studio['timestamps'][number];command:Command}){
 const [editing,setEditing]=useState(false);const [label,setLabel]=useState(stamp.label);const [seconds,setSeconds]=useState(stamp.seconds);
 useEffect(()=>{setLabel(stamp.label);setSeconds(stamp.seconds);},[stamp.label,stamp.seconds]);
 return <div className="item space-y-2"><div className="flex gap-3 items-center"><span className="flex-1">{formatTimestamp(stamp.seconds)} {stamp.label}</span><button onClick={()=>setEditing(!editing)}>{editing?'編集を閉じる':'編集'}</button><button onClick={()=>void command({type:'timestamp-remove',id:stamp.id})}>削除</button></div>{editing&&<div className="grid grid-cols-[150px_1fr] gap-2"><label>配信開始からの秒数<input type="number" min={0} max={359999} value={seconds} onChange={event=>setSeconds(Number(event.target.value))}/></label><label>見出し<input value={label} onChange={event=>setLabel(event.target.value)}/></label><button className="col-span-2" onClick={()=>void command({type:'timestamp-edit',id:stamp.id,label,seconds})}>時刻・見出しを保存</button></div>}</div>;
}


