import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function packagingEnv(input){
  const env={...input};
  for(const key of ['CSC_LINK','CSC_KEY_PASSWORD','APPLE_ID','APPLE_APP_SPECIFIC_PASSWORD','APPLE_TEAM_ID']){
    if(!env[key]?.trim())delete env[key];
  }
  // An empty CSC_LINK is interpreted as the current directory by macOS signing.
  if(!env.CSC_LINK)env.CSC_IDENTITY_AUTO_DISCOVERY='false';
  return env;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=spawnSync(process.execPath,['node_modules/electron-builder/cli.js','--publish','never'],{stdio:'inherit',env:packagingEnv(process.env)});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
}
