import { BrowserWindow,screen } from 'electron';
import Store from 'electron-store';
import { z } from 'zod';
import { fitWindow,type SavedWindow } from '../shared/window-layout';
const schema=z.object({x:z.number().finite().optional(),y:z.number().finite().optional(),width:z.number().finite().positive().optional(),height:z.number().finite().positive().optional(),maximized:z.boolean().optional()});
export class WindowPlacement {
 private store=new Store<{placement:SavedWindow}>({name:'window-state',defaults:{placement:{}}});
 restore(){const result=schema.safeParse(this.store.get('placement'));return fitWindow(result.success?result.data:{},screen.getAllDisplays().map(display=>display.workArea));}
 track(window:BrowserWindow){
  let timer:ReturnType<typeof setTimeout>|undefined;
  const save=()=>{if(timer)clearTimeout(timer);timer=undefined;if(window.isDestroyed()||window.isMinimized())return;try{this.store.set('placement',{...window.getNormalBounds(),maximized:window.isMaximized()});}catch(error){console.error('Window state save failed',error);}};
  const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(save,250);};
  window.on('move',schedule);window.on('resize',schedule);window.on('maximize',schedule);window.on('unmaximize',schedule);
  window.on('close',save);window.on('closed',()=>{if(timer)clearTimeout(timer);});
 }
 reset(window:BrowserWindow){const next=fitWindow({},screen.getAllDisplays().map(display=>display.workArea));this.store.set('placement',{});window.unmaximize();window.setMinimumSize(next.minWidth,next.minHeight);window.setBounds(next.bounds);}
}
