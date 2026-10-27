(() => {
 const button=document.createElement('button');button.textContent='テーマを自由に編集';button.onclick=()=>api.openThemes();document.querySelector('.bar.top')?.append(button);
 const style=document.createElement('style');document.head.append(style);
 const apply=s=>{const t=s.userTheme;if(!t){style.textContent='';return;}
 const fonts={sans:'"Yu Gothic UI",sans-serif',serif:'"Yu Mincho",serif',mono:'Consolas,monospace',round:'"Hiragino Maru Gothic ProN",sans-serif'};
 style.textContent=`:root{--bg:${t.bg};--panel:${t.surface};--text:${t.text};--dim:${t.muted};--accent:${t.accent};--line:${t.line};color:${t.text};background:${t.bg};font-family:${fonts[t.font]||fonts.sans}}body,.side,.box,.pane,.designer,#queue{background:${t.bg};color:${t.text}}button,input,select,textarea,.box,.row,.list{background:${t.surface};color:${t.text};border-color:${t.line};border-radius:${t.radius}px}button.primary,.row.play{border-color:${t.accent}}.dim,.small.dim{color:${t.muted}}`;
 };
 api.getState().then(apply);api.onState(apply);
})();

