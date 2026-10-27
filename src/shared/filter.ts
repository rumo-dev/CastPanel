import type { Comment, Settings } from './types';
export function filterComment(c:Comment,s:Settings):Comment|null {
 let text=c.text;
 for(const word of s.ngWords.filter(Boolean)) { if(!text.includes(word))continue; if(s.filterMode==='hide')return null; text=text.split(word).join('＊'.repeat(word.length)); }
 return {...c,text,emojis:text===c.text?c.emojis:[]};
}
export function speechText(text:string,replacements:Record<string,string>) { for(const [a,b] of Object.entries(replacements))if(a)text=text.split(a).join(b); return text.slice(0,500); }
