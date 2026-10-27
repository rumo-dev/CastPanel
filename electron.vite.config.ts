import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'node:path';
export default defineConfig({
 main:{plugins:[externalizeDepsPlugin()],build:{outDir:'dist/main',rollupOptions:{input:'src/main/main.ts'}}},
 preload:{plugins:[externalizeDepsPlugin()],build:{outDir:'dist/preload',rollupOptions:{input:'src/preload/index.ts',output:{format:'cjs',entryFileNames:'index.cjs'}}}},
 renderer:{root:'src/renderer',plugins:[react(),tailwind()],build:{outDir:resolve('dist/renderer')}}
});
