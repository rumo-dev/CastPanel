import { z } from 'zod';
export const themeIds=['simple','pop','dark','bubble','light','neon','sakura','purple','glass','retro','minimal','gold','mint','ocean','sunset'] as const;
export const themeSchema=z.enum(themeIds);
export const themeNames:Record<typeof themeIds[number],string>={simple:'シンプル',pop:'ポップ',dark:'ダーク',bubble:'吹き出し',light:'ライト',neon:'ネオン',sakura:'サクラ',purple:'パープル',glass:'ガラス',retro:'レトロ',minimal:'ミニマル',gold:'ゴールド',mint:'ミント',ocean:'オーシャン',sunset:'サンセット'};
export const palettes:Record<typeof themeIds[number],{bg:string;surface:string;text:string;muted:string;accent:string;line:string}>={
 dark:{bg:'#151820',surface:'#1d222c',text:'#dfe5ee',muted:'#98a3b5',accent:'#62d6c4',line:'#394352'},
 simple:{bg:'#f1f5f9',surface:'#ffffff',text:'#172033',muted:'#526277',accent:'#087f8c',line:'#c5d2df'},
 light:{bg:'#eef2f7',surface:'#ffffff',text:'#182a42',muted:'#52657a',accent:'#1468bd',line:'#c2d1e0'},
 pop:{bg:'#291a34',surface:'#3d2445',text:'#fff2fc',muted:'#e2b7d6',accent:'#ff8aca',line:'#805577'},
 bubble:{bg:'#edf7ff',surface:'#ffffff',text:'#213047',muted:'#526779',accent:'#197a9a',line:'#b9d7e7'},
 neon:{bg:'#090e1b',surface:'#101a2c',text:'#e2ffff',muted:'#91c1ce',accent:'#34f5dc',line:'#2b7b94'},
 sakura:{bg:'#fff0f4',surface:'#fffafd',text:'#542d44',muted:'#83586d',accent:'#b52d70',line:'#e4b6ca'},
 purple:{bg:'#19142c',surface:'#281e43',text:'#f1e9ff',muted:'#bbabd9',accent:'#c4a0ff',line:'#62507e'},
 glass:{bg:'#182739',surface:'#23384d',text:'#f0f8ff',muted:'#abc4d8',accent:'#91d9ff',line:'#5f8099'},
 retro:{bg:'#171d20',surface:'#243029',text:'#e8ffb6',muted:'#aac487',accent:'#c5ef6b',line:'#65764a'},
 minimal:{bg:'#f3f3f3',surface:'#ffffff',text:'#202020',muted:'#606060',accent:'#383838',line:'#c8c8c8'},
 gold:{bg:'#211b13',surface:'#31291c',text:'#fff0ce',muted:'#cdb990',accent:'#edc568',line:'#79623b'},
 mint:{bg:'#e9f8f2',surface:'#fafffd',text:'#173e35',muted:'#4b7266',accent:'#14755c',line:'#a7d5c6'},
 ocean:{bg:'#0b2033',surface:'#123248',text:'#e4f6ff',muted:'#99c1d7',accent:'#6ad5ff',line:'#386e89'},
 sunset:{bg:'#301b28',surface:'#482938',text:'#fff0e7',muted:'#dfb6ad',accent:'#ffb383',line:'#8c5963'},
};
export const overlayThemeCSS=themeIds.map(id=>{const p=palettes[id];return `.${id} .comment{background:${p.surface};color:${p.text};border:1px solid ${p.line}}.${id} .first{color:${p.accent}}.${id} .queue-playing{border-left:5px solid ${p.accent}}`;}).join('\n')+`.neon .comment{box-shadow:0 0 12px #34f5dc44}.glass .comment{background:#23384d99;backdrop-filter:blur(12px)}.retro .comment{border-radius:0;font-family:monospace}.minimal .comment{border-radius:0}.bubble .comment{border-radius:24px 24px 24px 0}.gold .comment{border-color:#edc568}.sakura .comment{border-radius:20px}`;
