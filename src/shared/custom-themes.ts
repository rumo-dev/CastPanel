import { z } from 'zod';
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const customThemeSchema=z.object({id:z.string().regex(/^[\w-]{1,80}$/),name:z.string().trim().min(1).max(80),bg:color,surface:color,text:color,muted:color,accent:color,line:color,radius:z.number().int().min(0).max(50).default(10),borderWidth:z.number().int().min(0).max(8).default(1),opacity:z.number().min(.05).max(1).default(1),font:z.enum(['sans','serif','mono','round']).default('sans'),shadow:z.number().int().min(0).max(40).default(0)});
export type CustomTheme=z.infer<typeof customThemeSchema>;
export const fonts={sans:'"Yu Gothic UI",Meiryo,sans-serif',serif:'"Yu Mincho",serif',mono:'Consolas,monospace',round:'"Hiragino Maru Gothic ProN","Yu Gothic UI",sans-serif'};
export const themeFileSchema=z.object({type:z.literal('castpanel-theme'),version:z.literal(1),theme:customThemeSchema});
