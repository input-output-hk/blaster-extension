import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: resolve(__dirname, 'entrypoint'),
  build: {
    outDir: resolve(__dirname, '../build'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        propertyPanel: resolve(__dirname, 'entrypoint/propertyPanel.html'),
        solverConfig: resolve(__dirname, 'entrypoint/solverConfig.html'),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
})
