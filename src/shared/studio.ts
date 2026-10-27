import { fullParticipationSchema } from './full-participation';
import { customThemeSchema } from './custom-themes';
import { participationSchema,queueConfigSchema,queueAppearanceSchema,queueActionSchema } from './participation';
import { themeSchema } from './themes';
import { layoutSchema } from './overlay-layout';
import { z } from 'zod';
import type { Comment, Settings } from './types';

export const profileSchema = z.object({ nickname:z.string().max(100).default(''), memo:z.string().max(2000).default(''), blocked:z.boolean().default(false), muted:z.boolean().default(false),iconPermission:z.enum(['unknown','allowed','denied']).optional() });
export const speechOverrideSchema=z.object({enabled:z.boolean(),engine:z.enum(['speech','voicevox','voicepeak','aivis','coeiroink','bouyomi']).optional(),speaker:z.number().int().min(0).max(2147483647).optional(),rate:z.number().min(0.5).max(2).optional(),volume:z.number().min(0).max(1).optional(),readName:z.boolean().optional(),coeiroSpeaker:z.string().max(100).optional(),voiceURI:z.string().max(500).optional(),priority:z.number().int().min(0).max(5).optional()});
export const ruleSchema = z.object({ id:z.string().max(80), word:z.string().min(1).max(100), message:z.string().max(300), enabled:z.boolean(), cooldown:z.number().int().min(0).max(3600),hotkey:z.string().max(100).optional() });
const songSchema=z.object({id:z.string(),title:z.string().min(1).max(200),artist:z.string().max(200),done:z.boolean()});
export const pollSchema=z.object({
 id:z.string().default('legacy'),title:z.string().min(1).max(300),
 mode:z.enum(['choice','free']).default('choice'),
 options:z.array(z.string().min(1).max(100)).max(100),active:z.boolean(),
 votes:z.record(z.string(),z.number().int().nonnegative()),correct:z.number().int().min(-1).max(99),
 answerPrefix:z.string().max(30).default(''),
 durationSeconds:z.number().int().min(0).max(86400).default(0),
 closesAt:z.string().datetime().nullable().default(null),endedAt:z.string().datetime().nullable().default(null),
 aliases:z.record(z.string(),z.string().max(100)).default({}),
}).refine(p=>p.mode!=='choice'||p.options.length>=2,'選択式は2択以上必要です');
export const commentSchema=z.object({id:z.string().max(300),connectionId:z.string().max(100),platform:z.enum(['youtube','twitch','twitcasting']),userId:z.string().max(300),username:z.string().max(300),text:z.string().max(10000),timestamp:z.string().datetime(),emojis:z.array(z.object({url:z.string().max(2048),alt:z.string().max(300)})).max(100),gift:z.object({kind:z.enum(['superchat','sticker','membership','bits','subscription','points']),amount:z.number().nonnegative().optional(),currency:z.string().max(30).optional(),label:z.string().max(1000)}).optional(),firstVisit:z.boolean().optional(),newVisit:z.boolean().optional(),returning:z.boolean().optional(),nickname:z.string().max(100).optional(),translation:z.string().max(10000).optional()});
export const studioSchema=z.object({
 fullParticipation:fullParticipationSchema.optional(),
 profiles:z.record(z.string(),profileSchema).default({}),
 stocks:z.array(commentSchema).max(1000).default([]),
 bookmarks:z.array(z.string()).max(1000).default([]),
 pinned:commentSchema.nullable().default(null),
 participation:participationSchema.default(()=>participationSchema.parse({})),
 poll:pollSchema.nullable().default(null),
 pollHistory:z.array(pollSchema).max(30).default([]),
 rules:z.array(ruleSchema).max(100).default([]),
 setlist:z.array(songSchema).max(500).default([]),
 streamStartedAt:z.union([z.literal(''),z.string().datetime()]).default(''),
 timestamps:z.array(z.object({id:z.string(),seconds:z.number().nonnegative(),label:z.string().max(300)})).max(1000).default([]),
 overlay:z.object({fontSize:z.number().int().min(12).max(80).default(24),maxComments:z.number().int().min(1).max(100).default(20),lifetime:z.number().int().min(0).max(3600).default(0),showPlatform:z.boolean().default(true),layout:layoutSchema.default(()=>layoutSchema.parse({}))}).default(()=>({fontSize:24,maxComments:6,lifetime:30,showPlatform:true,layout:layoutSchema.parse({})})),
 split:z.boolean().default(false),
 translation:z.object({enabled:z.boolean(),target:z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/)}).default({enabled:false,target:'ja'}),
 plugins:z.array(z.object({id:z.string(),name:z.string().min(1).max(100),endpoint:z.string().url().refine(value=>{const u=new URL(value);return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&!u.username&&!u.password;},'127.0.0.1のHTTP URLを指定してください'),enabled:z.boolean()})).max(30).default([]),
});
export type Studio = z.infer<typeof studioSchema>;
export type UserProfile=z.infer<typeof profileSchema>;
export const emptyStudio=():Studio=>studioSchema.parse({});

const id=z.string().min(1).max(200);
export const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('profile'),key:id,profile:profileSchema}),
 z.object({type:z.literal('delete'),id}),z.object({type:z.literal('clear')}),
 z.object({type:z.literal('pin'),id:id.nullable()}),z.object({type:z.literal('stock'),id}),z.object({type:z.literal('unstock'),id}),z.object({type:z.literal('bookmark'),id}),
 z.object({type:z.literal('participation'),enabled:z.boolean(),joinWord:z.string().min(1).max(100),leaveWord:z.string().min(1).max(100)}),
 z.object({type:z.literal('join'),id}),
 z.object({type:z.literal('queue-accept'),enabled:z.boolean()}),
 z.object({type:z.literal('queue-config'),config:queueConfigSchema}),z.object({type:z.literal('queue-appearance'),appearance:queueAppearanceSchema}),
 z.object({type:z.literal('queue-add'),platform:z.enum(['youtube','twitch','twitcasting','manual']),userId:z.string().trim().min(1).max(300),name:z.string().trim().min(1).max(300)}),
 z.object({type:z.literal('queue-action'),action:queueActionSchema,key:z.string().max(400).optional()}),
 z.object({type:z.literal('queue'),key:z.string().min(1).max(400),action:z.enum(['remove','done','up','down'])}),
 z.object({type:z.literal('shuffle')}),z.object({type:z.literal('least-played')}),
 z.object({type:z.literal('poll-create'),title:z.string().trim().min(1).max(300),options:z.array(z.string().trim().min(1).max(100)).max(12).refine(v=>new Set(v.map(s=>s.normalize('NFKC').toLowerCase())).size===v.length,'選択肢は重複できません'),correct:z.number().int().min(-1).max(11),mode:z.enum(['choice','free']).optional(),answerPrefix:z.string().max(30).optional(),durationSeconds:z.number().int().min(0).max(86400).optional()}).refine(c=>c.mode==='free'||c.options.length>=2,'選択式は2択以上必要です'),
 z.object({type:z.literal('poll-toggle'),active:z.boolean()}),
 z.object({type:z.literal('poll-merge'),source:z.number().int().nonnegative(),target:z.number().int().nonnegative()}),
 z.object({type:z.literal('poll-reuse'),id}),z.object({type:z.literal('poll-history-delete'),id}),
 z.object({type:z.literal('rules'),rules:z.array(ruleSchema).max(100)}),z.object({type:z.literal('effect'),id}),
 z.object({type:z.literal('setlist-add'),title:z.string().min(1).max(200),artist:z.string().max(200)}),
 z.object({type:z.literal('setlist-update'),id,action:z.enum(['done','remove','up','down'])}),
 z.object({type:z.literal('setlist-edit'),id,title:z.string().trim().min(1).max(200),artist:z.string().max(200)}),
 z.object({type:z.literal('stream-start')}),z.object({type:z.literal('timestamp'),label:z.string().min(1).max(300)}),
 z.object({type:z.literal('stream-time'),startedAt:z.string().datetime()}),
 z.object({type:z.literal('timestamp-edit'),id,label:z.string().trim().min(1).max(300),seconds:z.number().int().min(0).max(359999)}),
 z.object({type:z.literal('timestamp-remove'),id}),
 z.object({type:z.literal('overlay'),overlay:studioSchema.shape.overlay}),z.object({type:z.literal('split'),value:z.boolean()}),
 z.object({type:z.literal('translate'),id}),z.object({type:z.literal('translation-config'),enabled:z.boolean(),target:z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/)}),
 z.object({type:z.literal('plugin-add'),name:z.string().min(1).max(100),endpoint:studioSchema.shape.plugins.unwrap().element.shape.endpoint}),
 z.object({type:z.literal('plugin-toggle'),id,enabled:z.boolean()}),z.object({type:z.literal('plugin-remove'),id}),
]);
export type StudioCommand=z.infer<typeof commandSchema>;
export interface Effect {id:string;message:string;timestamp:string;hotkey?:string}
export interface LogQuery {query:string;from:string;to:string;platform:string}
export interface LogResult {comments:Comment[];total:number;users:number;gifts:number;byPlatform:Record<string,number>;byHour:Record<string,number>;truncated:boolean}
export interface BackupInfo {name:string;date:string;bytes:number}
export interface TesterInput {connectionId:string;username:string;userId:string;text:string;giftLabel:string;amount?:number}
export const testerSchema=z.object({connectionId:id,username:z.string().min(1).max(100),userId:z.string().min(1).max(100),text:z.string().max(5000),giftLabel:z.string().max(200),amount:z.number().nonnegative().max(1e9).optional()});
export const settingsSchema=z.object({connections:z.array(z.object({id:z.string().min(1).max(80),platform:z.enum(['youtube','twitch','twitcasting']),target:z.string().max(2048),connect:z.boolean(),tts:z.boolean(),tracking:z.boolean(),export:z.boolean(),overlay:z.boolean().optional(),name:z.string().max(100).optional(),speech:speechOverrideSchema.optional()})).max(20).refine(v=>new Set(v.map(c=>c.id)).size===v.length,'接続IDが重複しています'),theme:themeSchema,appTheme:themeSchema.optional(),customThemes:z.array(customThemeSchema).max(30).optional(),appCustomTheme:z.string().max(80).optional(),obsCustomTheme:z.string().max(80).optional(),queueCustomTheme:z.string().max(80).optional(),ngWords:z.array(z.string().max(100)).max(200),filterMode:z.enum(['hide','mask']),replacements:z.record(z.string().max(100),z.string().max(200)),ttsEngine:z.enum(['speech','voicevox','voicepeak','aivis','coeiroink','bouyomi']),speaker:z.number().int().min(0).max(2147483647),speechRate:z.number().min(0.5).max(2).optional(),speechVolume:z.number().min(0).max(1).optional(),readName:z.boolean().optional(),coeiroSpeaker:z.string().max(100).optional(),voiceURI:z.string().max(500).optional(),speechFallback:z.boolean().optional()});
export const validateSettings=(input:unknown):Settings=>settingsSchema.parse(input);







