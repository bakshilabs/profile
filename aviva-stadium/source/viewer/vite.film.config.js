// Static build of the film page, so rendering is not disturbed by hot reloads.
// Build:  npx vite build -c vite.film.config.js
// Serve:  npx vite preview -c vite.film.config.js     (port 5190)
// The public data and the model are linked in rather than copied.
import { defineConfig } from 'vite';
export default defineConfig({
  build: { outDir: 'dist-film', emptyOutDir: true, copyPublicDir: false, chunkSizeWarningLimit: 5000, rollupOptions: { input: 'film.html' } },
  preview: { port: 5190, strictPort: true },
});
