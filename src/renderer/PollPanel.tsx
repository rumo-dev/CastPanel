import { overlayViewUrl } from '../shared/overlay-url';
import { useEffect,useState } from 'react';
import type { Snapshot } from '../shared/types';
import type { StudioCommand } from '../shared/studio';
import { pollCounts,pollIsActive } from '../shared/poll';

type Props={state:Snapshot;command:(command:StudioCommand)=>Promise<void>};
export function PollPanel({state,command}:Props){
 const [title,setTitle]=useState('次の配信は？');
 const [mode,setMode]=useState<'choice'|'free'>('choice');
 const [options,setOptions]=useState('ゲーム\n雑談');
 const [correct,setCorrect]=useState(-1);
 const [prefix,setPrefix]=useState('');
 const [duration,setDuration]=useState(0);
 const [source,setSource]=useState(-1);
 const [target,setTarget]=useState(-1);
 const [now,setNow]=useState(Date.now());
 const poll=state.studio.poll;
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{setSource(-1);setTarget(-1);},[poll?.id]);
 const counts=poll?pollCounts(poll):[];
 const total=counts.reduce((sum,count)=>sum+count,0);
 const active=poll?pollIsActive(poll,now):false;
 const remaining=poll?.closesAt?Math.max(0,Math.ceil((Date.parse(poll.closesAt)-now)/1000)):null;
 return <section className="space-y-4">
  <h2>アンケート・クイズ</h2>
  <p className="muted">1人1票。再投票は前の回答を置き換えます。自由回答は最大100種類を集計します。</p>
  <label className="block">回答形式<select value={mode} onChange={event=>{const value=event.target.value as 'choice'|'free';setMode(value);setPrefix(value==='free'?'!投票':'');}}><option value="choice">選択式・クイズ</option><option value="free">自由回答</option></select></label>
  <label className="block">質問<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={300}/></label>
  {mode==='choice'&&<><label className="block">選択肢（1行1件／2〜12件）<textarea rows={4} value={options} onChange={event=>setOptions(event.target.value)}/></label><label className="block">正解番号（アンケートなら0）<input type="number" min={0} max={12} value={correct+1} onChange={event=>setCorrect(Number(event.target.value)-1)}/></label></>}
  <div className="grid grid-cols-2 gap-3"><label>回答の接頭辞<input value={prefix} onChange={event=>setPrefix(event.target.value)} placeholder={mode==='free'?'!投票':'空欄なら番号のみ'} maxLength={30}/></label><label>受付時間（秒／0は無制限）<input type="number" min={0} max={86400} value={duration} onChange={event=>setDuration(Number(event.target.value))}/></label></div>
  <p className="muted">回答例: {prefix}{prefix?' ':''}{mode==='free'?'好きなゲーム':'1'}</p>
  <button onClick={()=>void command({type:'poll-create',title,mode,options:mode==='free'?[]:options.split('\n').map(value=>value.trim()).filter(Boolean),correct:mode==='free'?-1:correct,answerPrefix:prefix,durationSeconds:duration})}>新しく受付を開始</button>
  {poll&&<div className="item space-y-3">
   <div className="flex justify-between gap-2"><h3>{poll.title}</h3><span>{active?'受付中':'終了'} / {total}票 {active&&remaining!==null?`/ 残り ${remaining}秒`:''}</span></div>
   <p className="muted">{poll.mode==='free'?'自由回答':'選択式'}{poll.answerPrefix?` ／ 接頭辞: ${poll.answerPrefix}`:''}</p>
   {!poll.options.length&&<p className="muted">回答を待っています。</p>}
   {poll.options.map((option,index)=><div key={index}><div className="flex justify-between gap-2"><span className="break-words">{index+1}. {option} {!active&&poll.correct===index?'✓ 正解':''}</span><span>{counts[index]}票</span></div><progress className="w-full" max={total||1} value={counts[index]}/></div>)}
   <button onClick={()=>void command({type:'poll-toggle',active:!active})}>{active?'締め切る':'受付を再開'}</button>
   {!active&&poll.durationSeconds>0&&<p className="muted">再開すると受付時間を最初から数え直します。投票済みの回答は保持します。</p>}
   {poll.mode==='free'&&poll.options.length>1&&<fieldset className="border-t border-slate-700 pt-3 space-y-3"><legend className="text-sm">表記ゆれを統合</legend><p className="muted">統合元への以後の回答も統合先に集計します。同じ人の票は増えません。</p><div className="grid grid-cols-2 gap-3"><label>統合元<select value={source} onChange={event=>setSource(Number(event.target.value))}><option value={-1}>回答を選択</option>{poll.options.map((option,index)=><option key={index} value={index}>{option}</option>)}</select></label><label>統合先<select value={target} onChange={event=>setTarget(Number(event.target.value))}><option value={-1}>回答を選択</option>{poll.options.map((option,index)=><option key={index} value={index}>{option}</option>)}</select></label></div><button disabled={source<0||target<0||source===target||source>=poll.options.length||target>=poll.options.length} onClick={()=>{void command({type:'poll-merge',source,target});setSource(-1);setTarget(-1);}}>回答を統合</button></fieldset>}
  </div>}
  <p className="muted select-all">{state.overlayUrl?overlayViewUrl(state.overlayUrl,'poll'):'OBSサーバー未接続'}</p>
  <details className="item"><summary>過去の質問（最大30件）</summary><p className="muted my-3">新しい質問を開始すると前の質問を保存します。再利用時は回答をリセットします。</p>{[...state.studio.pollHistory].reverse().map(old=><div className="border-t border-slate-700 py-3" key={old.id}><p>{old.title} · {Object.keys(old.votes).length}票</p><div className="flex gap-2 mt-2"><button onClick={()=>void command({type:'poll-reuse',id:old.id})}>再利用して受付開始</button><button onClick={()=>void command({type:'poll-history-delete',id:old.id})}>履歴から削除</button></div></div>)}</details>
 </section>;
}


