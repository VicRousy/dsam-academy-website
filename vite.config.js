import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve('index.html'),
        auth: resolve('auth.html'),
        dashboard: resolve('dashboard.html'),
        admin: resolve('admin.html'),
        adminLogin: resolve('admin-login.html'),
        staffLogin: resolve('staff-login.html'),
      },
    },
  },
});
