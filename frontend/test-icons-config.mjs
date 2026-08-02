import { build } from "vite";
const inlineConfig = {
  root: process.cwd(),
  logLevel: "info",
  publicDir: false,
  build: {
    outDir: "dist/test-icons",
    emptyOutDir: true,
    lib: { entry: "test-icons-entry.js", formats: ["es"] },
  },
  configFile: false,
  plugins: [],
};
try {
  await build(inlineConfig);
  console.log("ICONS BUILD OK");
} catch (e) {
  console.error("ICONS BUILD FAILED:", e.message.split("\n").slice(0, 6).join("\n"));
}
