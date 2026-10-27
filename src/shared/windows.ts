import { z } from 'zod';
export const panelNames={timeline:'コメント',participation:'参加型',poll:'投票・クイズ',stocks:'ストック',setlist:'曲・時刻',effects:'演出',listeners:'電子名簿',templates:'OBS配置',themes:'テーマ編集',logs:'ログ解析'};
export const panelSchema=z.enum(['timeline','participation','poll','stocks','setlist','effects','listeners','templates','themes','logs']);
export type Panel=keyof typeof panelNames;
