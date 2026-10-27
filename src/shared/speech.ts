import type { Settings,TTSEngineName } from './types';
export interface SpeechConfig {ttsEngine:TTSEngineName;speaker:number;speechRate:number;speechVolume:number;readName:boolean;coeiroSpeaker:string;voiceURI:string;priority:number;fallback:boolean}
export function resolveSpeech(settings:Settings,connectionId:string):SpeechConfig{
 const override=settings.connections.find(connection=>connection.id===connectionId)?.speech;
 const value=override?.enabled?override:undefined;
 return {ttsEngine:value?.engine??settings.ttsEngine,speaker:value?.speaker??settings.speaker,speechRate:value?.rate??settings.speechRate??1,speechVolume:value?.volume??settings.speechVolume??1,readName:value?.readName??settings.readName??false,coeiroSpeaker:value?.coeiroSpeaker??settings.coeiroSpeaker??'',voiceURI:value?.voiceURI??settings.voiceURI??'',priority:value?.priority??0,fallback:settings.speechFallback!==false};
}
