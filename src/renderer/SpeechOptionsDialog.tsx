import { useEffect,useRef,useState } from 'react';
import type { Connection,Settings,SpeechOverrides } from '../shared/types';
const engines=[['speech','Web Speech API'],['voicevox','VOICEVOX'],['aivis','AivisSpeech'],['coeiroink','COEIROINK v2'],['bouyomi','棒読みちゃん'],['voicepeak','VOICEPEAK（未実装）']];
export function useSpeechVoices(){
 const [voices,setVoices]=useState<SpeechSynthesisVoice[]>(()=>window.speechSynthesis?.getVoices()||[]);
 useEffect(()=>{const refresh=()=>setVoices(window.speechSynthesis?.getVoices()||[]);window.speechSynthesis?.addEventListener('voiceschanged',refresh);refresh();return()=>window.speechSynthesis?.removeEventListener('voiceschanged',refresh);},[]);
 return voices;
}
export function SpeechOptionsDialog({connection,settings,onSave,close}:{connection:Connection;settings:Settings;onSave:(value:SpeechOverrides)=>Promise<boolean|undefined>;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const [value,setValue]=useState<SpeechOverrides>(connection.speech||{enabled:false});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const voices=useSpeechVoices();
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 const update=<K extends keyof SpeechOverrides>(key:K,next:SpeechOverrides[K])=>setValue({...value,[key]:next});
 const engine=value.engine??settings.ttsEngine;
 return <dialog ref={dialog} className="profile-dialog speech-dialog" aria-label="枠別読み上げ設定" onCancel={close}>
  <div className="flex justify-between items-center mb-4"><h2>枠別読み上げ設定</h2><button onClick={close}>閉じる</button></div>
  <p className="muted mb-4">{connection.name||connection.platform} — 空欄・「共通設定」はアプリ全体の設定を使います。</p>
  <label className="block mb-4"><input type="checkbox" checked={value.enabled} onChange={event=>update('enabled',event.target.checked)}/> この枠の読み上げ設定を上書きする</label>
  <fieldset disabled={!value.enabled||busy} className="space-y-4">
   <label className="block">音声エンジン<select value={value.engine??''} onChange={event=>update('engine',(event.target.value||undefined) as SpeechOverrides['engine'])}><option value="">共通設定（{settings.ttsEngine}）</option>{engines.map(([key,name])=><option value={key} key={key}>{name}</option>)}</select></label>
   {engine==='speech'?<label className="block">音声<select value={value.voiceURI??'__inherit'} onChange={event=>update('voiceURI',event.target.value==='__inherit'?undefined:event.target.value)}><option value="__inherit">共通設定の音声</option><option value="">OSの既定音声</option>{voices.map(voice=><option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}（{voice.lang}）</option>)}</select>{!voices.length&&<span className="muted">利用可能な音声がまだありません。OSの音声設定を確認してください。</span>}</label>:engine!=='bouyomi'&&<label className="block">speaker / style ID<input type="number" min={0} max={2147483647} placeholder={`共通設定: ${settings.speaker}`} value={value.speaker??''} onChange={event=>update('speaker',event.target.value===''?undefined:Number(event.target.value))}/></label>}
   {engine==='coeiroink'&&<label className="block">COEIROINK speaker UUID<input placeholder={settings.coeiroSpeaker||'共通設定'} value={value.coeiroSpeaker??''} onChange={event=>update('coeiroSpeaker',event.target.value||undefined)}/></label>}
   <div className="grid grid-cols-2 gap-3"><label>速度（0.5〜2）<input type="number" min={0.5} max={2} step={0.1} value={value.rate??''} placeholder={`共通: ${settings.speechRate??1}`} onChange={event=>update('rate',event.target.value===''?undefined:Number(event.target.value))}/></label><label>音量（0〜1）<input type="number" min={0} max={1} step={0.1} value={value.volume??''} placeholder={`共通: ${settings.speechVolume??1}`} onChange={event=>update('volume',event.target.value===''?undefined:Number(event.target.value))}/></label></div>
   <div className="grid grid-cols-2 gap-3"><label>名前の読み上げ<select value={value.readName===undefined?'inherit':String(value.readName)} onChange={event=>update('readName',event.target.value==='inherit'?undefined:event.target.value==='true')}><option value="inherit">共通設定</option><option value="true">読み上げる</option><option value="false">読み上げない</option></select></label><label>待機キューの優先度<select value={value.priority??0} onChange={event=>update('priority',Number(event.target.value))}>{[0,1,2,3,4,5].map(priority=><option key={priority} value={priority}>{priority}{priority===0?'（通常）':priority===5?'（最優先）':''}</option>)}</select></label></div>
  </fieldset>
  <p className="muted my-4">優先度は待機中のコメントに適用します。再生中の音声は最後まで読み上げます。棒読みちゃんの速度・音量は本体設定を使用します。</p>
  {error&&<p className="text-red-300 text-sm mb-3" role="alert">{error}</p>}
  <button className="primary" disabled={busy} onClick={async()=>{const invalid=dialog.current?.querySelector<HTMLInputElement>('input:invalid');if(invalid){invalid.reportValidity();return;}setError('');setBusy(true);try{if(await onSave(value))close();else setError('保存できませんでした。入力値とアプリの通知を確認してください。');}catch(error){setError(String(error));}finally{setBusy(false);}}}>{busy?'保存中…':'この枠の設定を保存'}</button>
 </dialog>;
}
