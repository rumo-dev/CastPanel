export function overlayViewUrl(base:string,view='all'){
 if(!base)return '';
 try{const url=new URL(base);if(view==='all')url.searchParams.delete('view');else url.searchParams.set('view',view);return url.href;}catch{return '';}
}
