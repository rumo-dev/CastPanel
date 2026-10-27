import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customThemeSchema,themeFileSchema } from '../src/shared/custom-themes';
import { palettes } from '../src/shared/themes';
import { settingsSchema } from '../src/shared/studio';
import { panelSchema } from '../src/shared/windows';
const theme={id:'my-theme',name:'マイテーマ',...palettes.mint,radius:20,borderWidth:2,opacity:.75,font:'mono',shadow:12};
test('custom themes round-trip with no executable styling or remote resources',()=>{const parsed=customThemeSchema.parse(theme);assert.deepEqual(themeFileSchema.parse(JSON.parse(JSON.stringify({type:'castpanel-theme',version:1,theme:parsed}))).theme,parsed);for(const patch of [{accent:'url(https://evil)'},{text:'#fff;display:none'},{font:'url(evil)'},{radius:100},{opacity:0},{id:'../../escape'}])assert.equal(customThemeSchema.safeParse({...theme,...patch}).success,false);});
test('theme choices and saved library survive validated settings',()=>{assert.ok(settingsSchema.shape.customThemes.safeParse([theme]).success);assert.equal(settingsSchema.shape.customThemes.safeParse(Array.from({length:31},()=>theme)).success,false);assert.equal(panelSchema.safeParse('https://evil').success,false);assert.ok(panelSchema.safeParse('themes').success);});
