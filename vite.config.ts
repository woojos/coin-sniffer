import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works under the GitHub Pages project path.
  base: './',
  build: {
    // Phaser alone is ~1.4 MB minified; that is expected for a single-bundle game.
    chunkSizeWarningLimit: 1600,
  },
});
