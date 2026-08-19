import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,

    // The browser only ever talks to localhost:5173. Any request whose path
    // starts with /api is forwarded by Vite to the Express server on
    // localhost:4000, and the reply is handed back.
    //
    // Why not fetch http://localhost:4000 directly from React? To a browser,
    // :5173 and :4000 are different origins, which means CORS headers on the
    // server and cookies that get dropped unless several options line up.
    // Proxying keeps the frontend on one origin, so neither problem exists.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
