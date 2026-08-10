import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'lottie-web': 'lottie-web/build/player/lottie_light',
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local'],
  },
})
