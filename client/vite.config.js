import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,

    // STEP 2 — uncomment once the Node server exists.
    // The browser will keep talking to localhost:5173, but Vite forwards any
    // request starting with /api to the Express server on localhost:4000.
    // That keeps the frontend on a single origin, so there is no CORS setup
    // and cookies "just work" in development.
    //
    // proxy: {
    //   '/api': 'http://localhost:4000',
    // },
  },
})
