export const MEDIA_HOSTS=['yt3.ggpht.com','yt3.googleusercontent.com','www.youtube.com','i.ytimg.com','static-cdn.jtvnw.net','cdn.twitcasting.tv'];
const hosts=new Set(MEDIA_HOSTS);
export function trustedMedia(value:string|undefined){if(!value)return undefined;try{const url=new URL(value);return url.protocol==='https:'&&hosts.has(url.hostname)&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}}
