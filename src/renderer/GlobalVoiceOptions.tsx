import type { Settings } from '../shared/types';
import { useSpeechVoices } from './SpeechOptionsDialog';
export function GlobalVoiceOptions({settings,change}:{settings:Settings;change:<K extends keyof Settings>(key:K,value:Settings[K])=>void}){
 const voices=useSpeechVoices();
 return <div className="space-y-3"><label className="block">Web Speech APIの音声<select value={settings.voiceURI||''} onChange={event=>change('voiceURI',event.target.value)}><option value="">OSの既定音声</option>{voices.map(voice=><option value={voice.voiceURI} key={voice.voiceURI}>{voice.name}（{voice.lang}）</option>)}</select></label><label className="block"><input type="checkbox" checked={settings.speechFallback!==false} onChange={event=>change('speechFallback',event.target.checked)}/> 音声エンジンの失敗時にWeb Speech APIへ切り替える</label><p className="muted">各接続先の「⋯」→「読み上げ設定」で、エンジン・声・速度・音量・優先度を枠ごとに変更できます。</p></div>;
}
