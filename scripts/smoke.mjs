import { app, BrowserWindow } from 'electron';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Isolate smoke checks from the user's saved connections and listener database.
const data = resolve('.smoke-data');
mkdirSync(data, { recursive: true });
app.setPath('userData', data);
const timeout = setTimeout(() => {
  console.error('SMOKE FAILED: startup timed out');
  app.exit(1);
}, 20000);
app.on('web-contents-created', (_, contents) => {
  if (contents.getURL() === 'about:blank') return;
  contents.once('did-finish-load', async () => {
    try {
      const result = await contents.executeJavaScript(`(async () => {
        if (!window.castpanel) throw new Error('Preload API missing');
        const state = await window.castpanel.snapshot();
        for (let i = 0; i < 50 && !document.body.innerText.includes('CastPanel'); i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return { connections: state.settings.connections.length, title: document.title,
          rendered: document.body.innerText.includes('CastPanel') };
      })()`);
      if (result.connections !== 2 || !result.rendered) throw new Error(JSON.stringify(result));
      console.log('SMOKE OK:', JSON.stringify(result));
      const main = BrowserWindow.fromWebContents(contents);
      if (!main) throw new Error('Main window missing');
      // Reproduce a hidden YouTube window keeping window-all-closed from firing.
      const hidden = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
      app.once('quit', () => {
        clearTimeout(timeout);
        if (!hidden.isDestroyed()) {
          console.error('SMOKE FAILED: hidden window survived shutdown');
          process.exitCode = 1;
        } else console.log('SMOKE OK: main-window close shuts down hidden windows and exits');
      });
      main.close();
    } catch (error) {
      console.error('SMOKE FAILED:', error);
      app.exit(1);
    }
  });
});
await import(pathToFileURL(resolve('dist/main/main.js')).href);
