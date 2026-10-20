// Static build of the analysis page and the digital twin page for publishing under a sub-folder of a site.
// Build: npx vite build -c vite.site.config.js   (output in dist-site, with relative URLs)
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'dist-site', emptyOutDir: true, copyPublicDir: false, chunkSizeWarningLimit: 5000, rollupOptions: { input: { analysis: 'analysis.html', twin: 'twin.html' } } },
});
