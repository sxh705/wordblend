import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: fileURLToPath(new URL('../src/popup-dist', import.meta.url)),
    emptyOutDir: true,
    assetsDir: '.',
    target: 'chrome110',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'popup.js',
        chunkFileNames: 'popup-[name].js',
        assetFileNames: (asset) => (/\.css$/.test(asset.names ? asset.names[0] : asset.name || '')
          ? 'popup.css'
          : '[name][extname]')
      }
    }
  }
})
