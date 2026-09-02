import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The staff and admin surfaces connect to the same Supabase project.
  envDir: '../admin',
})
