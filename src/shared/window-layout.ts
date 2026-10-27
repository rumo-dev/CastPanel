export interface Rect {x:number;y:number;width:number;height:number}
export interface SavedWindow extends Partial<Rect> {maximized?:boolean}
export function fitWindow(saved:SavedWindow,workAreas:Rect[]){
 const areas=workAreas.filter(area=>area.width>0&&area.height>0);
 if(!areas.length)areas.push({x:0,y:0,width:1400,height:900});
 const finite=(value:number|undefined,fallback:number)=>Number.isFinite(value)?value!:fallback;
 const original={x:finite(saved.x,areas[0].x),y:finite(saved.y,areas[0].y),width:Math.max(1,finite(saved.width,1400)),height:Math.max(1,finite(saved.height,900))};
 let area=areas[0],best=0;
 for(const candidate of areas){const overlap=Math.max(0,Math.min(original.x+original.width,candidate.x+candidate.width)-Math.max(original.x,candidate.x))*Math.max(0,Math.min(original.y+original.height,candidate.y+candidate.height)-Math.max(original.y,candidate.y));if(overlap>best){area=candidate;best=overlap;}}
 const minWidth=Math.min(1000,area.width),minHeight=Math.min(620,area.height);
 const width=Math.round(Math.max(minWidth,Math.min(area.width,original.width))),height=Math.round(Math.max(minHeight,Math.min(area.height,original.height)));
 const positioned=best>0&&Number.isFinite(saved.x)&&Number.isFinite(saved.y);
 const x=Math.round(Math.max(area.x,Math.min(area.x+area.width-width,positioned?original.x:area.x+(area.width-width)/2)));
 const y=Math.round(Math.max(area.y,Math.min(area.y+area.height-height,positioned?original.y:area.y+(area.height-height)/2)));
 return {bounds:{x,y,width,height},minWidth,minHeight,maximized:saved.maximized===true};
}
