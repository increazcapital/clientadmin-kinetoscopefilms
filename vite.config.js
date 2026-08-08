import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawTarget = env.VITE_API_URL_LOCAL || 'http://127.0.0.1:5000';
  const target = rawTarget.trim().replace('localhost', '127.0.0.1');

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
