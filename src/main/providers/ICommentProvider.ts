import type { Comment,Connection } from '../../shared/types';
export interface ICommentProvider { connect(config:Connection,onComment:(c:Comment)=>void,onStatus:(s:string)=>void):Promise<void>; disconnect():void }
