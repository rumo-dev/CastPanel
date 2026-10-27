export type Platform = 'youtube' | 'twitch' | 'twitcasting';
export type Theme = 'simple' | 'pop' | 'dark' | 'bubble';
export interface Gift { kind: 'superchat'|'sticker'|'membership'|'bits'|'subscription'|'points'; amount?: number; currency?: string; label: string }
export interface Comment { id:string; connectionId:string; platform:Platform; userId:string; username:string; text:string; timestamp:string; emojis:{url:string; alt:string}[]; gift?:Gift; firstVisit?:boolean }
export interface Listener { firstSeen:string; lastSeen:string; username:string; count:number; gifts:Gift[] }
export interface Connection { id:string; platform:Platform; target:string; connect:boolean; tts:boolean; tracking:boolean; export:boolean }
export interface Settings { connections:Connection[]; theme:Theme; ngWords:string[]; filterMode:'hide'|'mask'; replacements:Record<string,string>; ttsEngine:'speech'|'voicevox'|'voicepeak'; speaker:number }
export interface Snapshot { settings:Settings; comments:Comment[]; listeners:Record<string,Listener>; statuses:Record<string,string>; update:string; overlayUrl:string }
export interface DesktopAPI { snapshot():Promise<Snapshot>; save(settings:Settings):Promise<void>; demo():Promise<void>; update(action:'check'|'install'):Promise<void>; subscribe(fn:(state:Snapshot)=>void):()=>void }
