import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(root, '../plugin/assets/dist');

/** URL of the dev server as seen by the browser (not the container). */
const devServerUrl = new URL(process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173');
/** Origin of the WordPress site that loads our modules (for CORS). */
const wpOrigin = new URL(process.env.WP_URL ?? 'http://localhost:8080').origin;

/**
 * Writes `<outDir>/hot` with the dev-server URL while `vite` is running.
 * PHP (src/Support/Vite.php) sees the file and loads assets from the dev
 * server with HMR; when it's gone, PHP falls back to the built manifest.
 */
function wordpressHotFile(): Plugin {
  const hotFile = path.join(outDir, 'hot');
  const removeHotFile = () => fs.rmSync(hotFile, { force: true });

  return {
    name: 'wordpress-hot-file',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(hotFile, devServerUrl.origin);
        server.config.logger.info(
          `  ➜  WordPress loads assets from ${devServerUrl.origin} (HMR on)`,
        );
      });
      process.once('exit', removeHotFile);
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
        process.once(signal, () => {
          removeHotFile();
          process.exit(0);
        });
      }
    },
  };
}

export default defineConfig(({ command }) => ({
  // Relative base so chunks/assets resolve from wherever the plugin is installed.
  base: command === 'build' ? './' : '/',
  plugins: [react(), tailwindcss(), wordpressHotFile()],
  resolve: {
    alias: [
      // Provided by WordPress at runtime (see src/wp-globals/README.md). Applies to
      // bundled dependencies too, so @wordpress/components shares wp.i18n.
      { find: /^@wordpress\/i18n$/, replacement: path.resolve(root, 'src/wp-globals/i18n.ts') },
      {
        find: /^@wordpress\/api-fetch$/,
        replacement: path.resolve(root, 'src/wp-globals/api-fetch.ts'),
      },
      { find: /^@\//, replacement: `${path.resolve(root, 'src')}/` },
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    origin: devServerUrl.origin,
    cors: { origin: [wpOrigin, /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/] },
    hmr: {
      host: devServerUrl.hostname,
      clientPort: Number(devServerUrl.port || 80),
    },
    watch: { usePolling: process.env.VITE_USE_POLLING === 'true' },
  },
  build: {
    outDir,
    emptyOutDir: true,
    manifest: true,
    target: 'es2022',
    // @wordpress/components is large; a separate vendor chunk stays cached across releases.
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      input: path.resolve(root, 'src/main.tsx'),
      output: {
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
}));
