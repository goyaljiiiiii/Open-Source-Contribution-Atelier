import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import zlib from "node:zlib";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

function visualizerThresholdPlugin(maxGzipKB = 250): Plugin {
  return {
    name: "visualizer-threshold-check",
    apply: "build",
    generateBundle(_, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk" && fileName.endsWith(".js")) {
          const gzipped = zlib.gzipSync(Buffer.from(chunk.code));
          const gzipKB = gzipped.length / 1024;
          if (gzipKB > maxGzipKB) {
            this.error(
              `Chunk "${fileName}" (${gzipKB.toFixed(1)} KB gzipped) exceeds the maximum allowed threshold of ${maxGzipKB} KB gzipped.`
            );
          }
        }
      }
    },
  };
}

function buildMetadataPlugin(): Plugin {
  return {
    name: "build-metadata",
    apply: "build",
    generateBundle() {
      const metadata = {
        version: process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36),
        builtAt: new Date().toISOString(),
      };
      this.emitFile({
        type: "asset",
        fileName: "build-metadata.json",
        source: JSON.stringify(metadata, null, 2),
      });
    },
  };
}

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    ...(process.env.DOCKER === "true" && {
      hmr: {
        clientPort: 5173,
      },
      watch: {
        usePolling: true,
      },
    }),
  },
  build: {
    sourcemap: "hidden",
  },
  define: {
    "process.env.VERCEL_GIT_COMMIT_SHA": JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA || ""
    ),
  },
  worker: {
    format: "es",
  },
  base: process.env.VITE_CDN_URL || "/",
  plugins: [
    buildMetadataPlugin(),
    visualizerThresholdPlugin(1000),
    react(),
    viteCompression({ algorithm: "brotliCompress", ext: ".br" }),
    viteCompression({ algorithm: "gzip", ext: ".gz" }),
    visualizer({
      filename: "dist/stats.html",
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
    }),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "prompt",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,md}"],
        maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
      },
      manifest: {
        name: "Contribution Atelier",
        short_name: "Atelier",
        theme_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "react-i18next"],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: "./src/test/setup.ts",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["**/*.stories.{ts,tsx}", "**/*.stories.{js,jsx}"],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: "playwright",
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
    optimizeDeps: {
      include: [
        "workbox-precaching",
        "workbox-routing",
        "workbox-strategies",
        "workbox-expiration",
        "@sentry/react",
      ],
    },
  },
});
