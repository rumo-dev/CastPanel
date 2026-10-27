import { useEffect,useRef,useState } from 'react';
import type { Comment,Snapshot } from '../shared/types';
import type { StudioCommand } from '../shared/studio';
import { trustedMedia } from '../shared/media';
import { platformNames } from './ConnectionTable';

type Props={state:Snapshot;stock?:boolean;gift?:boolean;title:string;fontSize:number;command:(command:StudioCommand)=>Promise<void>;select:(user:{key:string;name:string})=>void;onTester:()=>void;};
export function CommentLane({state,stock=false,gift=false,title,fontSize,command,select,onTester}:Props){
 const [query,setQuery]=useState('');const [connection,setConnection]=useState('');const [mode,setMode]=useState('all');const [filters,setFilters]=useState(false);
 const [paused,setPaused]=useState(false);const [unread,setUnread]=useState(0);
 const scroll=useRef<HTMLDivElement>(null);const follow=useRef(true);const previous=useRef(new Set<string>());
 const list=(stock?state.studio.stocks:state.comments).filter(comment=>{
  const profile=state.studio.profiles[`${comment.platform}:${comment.userId}`];
  return !profile?.blocked&&(!gift||comment.gift)&&(!connection||comment.connectionId===connection)&&(!query||`${comment.username} ${profile?.nickname||comment.nickname||''} ${comment.text}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))&&(mode==='all'||mode==='first'&&comment.firstVisit||mode==='return'&&comment.returning||mode==='bookmark'&&state.studio.bookmarks.includes(comment.id));
 });
 const lastId=list.at(-1)?.id;
 useEffect(()=>{const node=scroll.current;if(!node)return;const observer=new ResizeObserver(()=>{if(follow.current)node.scrollTop=node.scrollHeight;});observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  const added=list.filter(comment=>!previous.current.has(comment.id)).length;previous.current=new Set(list.map(comment=>comment.id));
  if(follow.current&&scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;
  else if(added)setUnread(count=>count+added);
 },[lastId,list.length,fontSize]);
 const latest=()=>{follow.current=true;setPaused(false);setUnread(0);if(scroll.current)scroll.current.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'});};
 const resetFollow=()=>{follow.current=true;setPaused(false);setUnread(0);};
 return <section className={`comment-lane ${gift?'gift-lane':''}`} aria-label={title}>
  <header className="lane-heading"><h2><span className={`lane-indicator ${gift?'gift-indicator':''}`}/>{title}<span className="count-pill">{list.length}</span></h2><button className={`icon-button ${filters?'is-active':''}`} aria-label={`${title}を絞り込み`} aria-expanded={filters} title="絞り込み" onClick={()=>setFilters(!filters)}>⌕</button></header>
  {filters&&<div className="lane-filters"><input aria-label={`${title}の検索`} placeholder="名前・コメントを検索" value={query} onChange={event=>{resetFollow();setQuery(event.target.value);}}/><div><select aria-label={`${title}の表示枠`} value={connection} onChange={event=>{resetFollow();setConnection(event.target.value);}}><option value="">すべての接続先</option>{state.settings.connections.map(item=><option value={item.id} key={item.id}>{item.name||platformNames[item.platform]}</option>)}</select><select aria-label={`${title}の表示条件`} value={mode} onChange={event=>{resetFollow();setMode(event.target.value);}}>{[['all','すべて'],['first','初見'],['return','再訪'],['bookmark','しおり']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div></div>}
  <div className="comment-scroll" ref={scroll} style={{'--comment-font-size':`${fontSize}px`} as React.CSSProperties} onScroll={()=>{const node=scroll.current;if(!node)return;const bottom=node.scrollHeight-node.scrollTop-node.clientHeight<48;follow.current=bottom;setPaused(!bottom);if(bottom)setUnread(0);}}>
   {!list.length&&<div className="empty-state"><div className="empty-symbol" aria-hidden="true">{gift?'◇':'…'}</div><h3>{gift?'ギフトを待っています':stock?'ストックはまだありません':'コメントを待っています'}</h3><p>{gift?'スパチャ・Bitsなどをまとめて表示します。':stock?'コメントの☆から保存できます。':'上の接続先をONにすると、ここに表示されます。'}</p>{!gift&&!stock&&<button className="button subtle" onClick={onTester}>テスターで表示を確認</button>}</div>}
   {list.map(comment=><CommentRow key={comment.id} comment={comment} state={state} stock={stock} command={command} select={select}/>)}
  </div>
  {paused&&<button className="latest-button" onClick={latest}>↓ 最新のコメントへ{unread>0?`（新着 ${unread}件）`:''}</button>}
 </section>;
}
function CommentRow({comment:c,state,stock,command,select}:{comment:Comment;state:Snapshot;stock:boolean;command:Props['command'];select:Props['select']}){
 const key=`${c.platform}:${c.userId}`;const profile=state.studio.profiles[key];const name=profile?.nickname||c.nickname||c.username;const saved=state.studio.stocks.some(item=>item.id===c.id);
 const toggleMute=()=>command({type:'profile',key,profile:{nickname:profile?.nickname||'',memo:profile?.memo||'',muted:!profile?.muted,blocked:profile?.blocked||false}});
 return <article className={`comment-row ${c.gift?'has-gift':''}`} data-platform={c.platform}>
  <div className="comment-avatar" aria-hidden="true">{Array.from(name)[0]||'?'}</div>
  <div className="comment-content"><div className="comment-meta"><button className="name-button" onClick={()=>select({key,name:c.username})}>{name}</button>{c.firstVisit?<span className="badge first-badge">初見</span>:c.returning?<span className="badge">再訪</span>:c.newVisit?<span className="badge">NEW</span>:null}{state.studio.bookmarks.includes(c.id)&&<span title="しおり">🔖</span>}<time dateTime={c.timestamp}>{new Date(c.timestamp).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</time><button className={`icon-button row-stock ${saved?'saved':''}`} aria-label={saved?'ストック解除':'ストック'} title={saved?'ストック解除':'ストック'} onClick={()=>void command({type:saved?'unstock':'stock',id:c.id})}>{saved?'★':'☆'}</button></div>
   <p className="comment-text">{c.text}</p>
   {c.emojis.length>0&&<div className="comment-emojis">{c.emojis.map((emoji,index)=>trustedMedia(emoji.url)?<img key={index} src={trustedMedia(emoji.url)} alt={emoji.alt} referrerPolicy="no-referrer"/>:null)}</div>}
   {c.translation&&<p className="comment-translation">翻訳: {c.translation}</p>}
   {c.gift&&<div className="gift-label">◇ {c.gift.label}</div>}
   <div className="comment-bottom"><span className="comment-source"><i/>{state.settings.connections.find(item=>item.id===c.connectionId)?.name||platformNames[c.platform]}</span>{profile?.muted&&<span className="muted">読上ミュート</span>}<details className="comment-actions"><summary aria-label={`${name}のコメント操作`}>操作 <span aria-hidden="true">⋯</span></summary><div>{(['pin','bookmark','join','translate','delete'] as const).map((type,index)=><button key={type} onClick={()=>void command({type,id:c.id})}>{['固定する','しおり','参加待ちに追加','翻訳','削除'][index]}</button>)}<button onClick={()=>void navigator.clipboard.writeText(c.text)}>コピー</button><button onClick={()=>void toggleMute()}>{profile?.muted?'ミュート解除':'読み上げミュート'}</button><button className="danger-text" onClick={()=>void command({type:'profile',key,profile:{nickname:profile?.nickname||'',memo:profile?.memo||'',muted:profile?.muted||false,blocked:true}})}>ブロック</button>{stock&&<button onClick={()=>void command({type:'unstock',id:c.id})}>ストック解除</button>}</div></details></div>
  </div>
 </article>;
}
