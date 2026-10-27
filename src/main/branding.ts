import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const appIcon=path.join(app.isPackaged?app.getAppPath():path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),'build/icon.png');
