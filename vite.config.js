import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_URL_LOCAL || 'http://localhost:5000';

  return {
    plugins: [react()],
    esbuild: mode === 'production' ? {
      drop: ['console', 'debugger']
    } : {},
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
