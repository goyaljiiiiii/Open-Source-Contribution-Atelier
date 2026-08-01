import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_SRC_DIR = path.join(ROOT_DIR, "frontend", "src");

function getFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== "dist" && file !== "build") {
        getFiles(filePath, fileList);
      }
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function checkBarrelImports() {
  const files = getFiles(FRONTEND_SRC_DIR);
  let violationCount = 0;

  const BARREL_IMPORT_REGEX = /import\s+\{([^}]+)\}\s+from\s+["']lucide-react["']/g;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("lucide-react") && line.includes("import") && line.includes("{")) {
        const matches = [...line.matchAll(BARREL_IMPORT_REGEX)];
        if (matches.length > 0) {
          violationCount++;
          const relativePath = path.relative(ROOT_DIR, file);
          console.warn(
            `⚠️  [BARREL IMPORT WARNING] File: ${relativePath}:${i + 1}\n` +
            `    Line: ${line.trim()}\n` +
            `    Tip: Use per-icon imports e.g., import IconName from "lucide-react/dist/esm/icons/icon-name"\n`
          );
        }
      }
    }
  }

  if (violationCount > 0) {
    console.warn(
      `\n⚠️  Found ${violationCount} lucide-react barrel import(s). Consider replacing them with per-icon imports to keep bundle size minimal.\n`
    );
  } else {
    console.log("✅ No lucide-react barrel imports found!");
  }
}

checkBarrelImports();
