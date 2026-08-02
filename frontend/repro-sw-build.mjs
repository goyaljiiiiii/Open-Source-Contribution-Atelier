import { build } from "vite";

const inlineConfig = {
  root: process.cwd(),
  base: "/",
  resolve: { dedupe: ["react", "react-dom", "react-i18next"] },
  mode: "production",
  publicDir: false,
  build: {
    target: "es2022",
    minify: true,
    sourcemap: true,
    outDir: "dist",
    emptyOutDir: false,
    modulePreload: false,
    rollupOptions: {
      input: "src/sw.js",
      output: { entryFileNames: "sw.mjs", inlineDynamicImports: true },
    },
  },
  configFile: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [],
};

try {
  await build(inlineConfig);
  console.log("SW build OK");
} catch (e) {
  console.error("SW build FAILED:", e.message.split("\n").slice(0, 6).join("\n"));
}
