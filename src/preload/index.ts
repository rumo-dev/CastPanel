import { contextBridge,ipcRenderer } from 'electron';
import type { DesktopAPI,Snapshot } from '../shared/types';
const api:DesktopAPI={snapshot:()=>ipcRenderer.invoke('snapshot'),save:s=>ipcRenderer.invoke('save',s),demo:()=>ipcRenderer.invoke('demo'),update:a=>ipcRenderer.invoke('update',a),subscribe:fn=>{const handler=(_:unknown,s:Snapshot)=>fn(s);ipcRenderer.on('state',handler);return()=>ipcRenderer.removeListener('state',handler);}};
contextBridge.exposeInMainWorld('castpanel',api);
