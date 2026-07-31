/**
 * IndexedDB-backed virtual filesystem with LightningFS-compatible API shape.
 * Falls back to in-memory storage when IndexedDB is unavailable.
 *
 * WASM-ready: storage layer can be swapped for a LightningFS / Emscripten FS bridge.
 */

const DB_NAME = "atelier-git-vfs";
const STORE_NAME = "files";
const DIR_MARKER = "__DIR__";

export class VfsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VfsError";
  }
}

function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.length === 0 ? "/" : `/${resolved.join("/")}`;
}

function parentPath(path: string): string {
  const norm = normalizePath(path);
  if (norm === "/") return "/";
  const idx = norm.lastIndexOf("/");
  return idx <= 0 ? "/" : norm.slice(0, idx);
}

function joinPath(base: string, name: string): string {
  if (base === "/") return normalizePath(`/${name}`);
  return normalizePath(`${base}/${name}`);
}

export class VirtualFileSystem {
  private memoryStore = new Map<string, string>();
  private useIndexedDB = true;
  private db: IDBDatabase | null = null;
  private ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  /** Initialise IndexedDB (or enable in-memory fallback). */
  async init(): Promise<void> {
    if (typeof indexedDB === "undefined") {
      this.useIndexedDB = false;
      return;
    }
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
      });
    } catch {
      this.useIndexedDB = false;
      this.db = null;
    }
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  private idbGet(key: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(undefined);
        return;
      }
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  private idbPut(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private idbDelete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private idbGetAllKeys(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve([]);
        return;
      }
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve((req.result as string[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  private async storeGet(key: string): Promise<string | undefined> {
    if (this.useIndexedDB && this.db) return this.idbGet(key);
    return this.memoryStore.get(key);
  }

  private async storePut(key: string, value: string): Promise<void> {
    if (this.useIndexedDB && this.db) await this.idbPut(key, value);
    else this.memoryStore.set(key, value);
  }

  private async storeDelete(key: string): Promise<void> {
    if (this.useIndexedDB && this.db) await this.idbDelete(key);
    else this.memoryStore.delete(key);
  }

  private async storeKeys(): Promise<string[]> {
    if (this.useIndexedDB && this.db) return this.idbGetAllKeys();
    return [...this.memoryStore.keys()];
  }

  private async ensureParentDirs(path: string): Promise<void> {
    const parent = parentPath(path);
    if (parent === "/") return;
    const exists = await this.storeGet(parent);
    if (exists === undefined) {
      await this.ensureParentDirs(parent);
      await this.storePut(parent, DIR_MARKER);
    }
  }

  private async assertParentExists(path: string): Promise<void> {
    const parent = parentPath(path);
    if (parent === "/") return;
    const entry = await this.storeGet(parent);
    if (entry !== DIR_MARKER) {
      throw new VfsError(`ENOENT: no such file or directory '${parent}'`);
    }
  }

  async readFile(
    path: string,
    opts?: { encoding?: "utf8" },
  ): Promise<string | Uint8Array> {
    await this.ensureReady();
    const key = normalizePath(path);
    const entry = await this.storeGet(key);
    if (entry === undefined) {
      throw new VfsError(`ENOENT: no such file '${path}'`);
    }
    if (entry === DIR_MARKER) {
      throw new VfsError(`EISDIR: illegal operation on a directory '${path}'`);
    }
    const bytes = new TextEncoder().encode(entry);
    if (opts?.encoding === "utf8" || opts?.encoding) {
      return entry;
    }
    return bytes;
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    await this.ensureReady();
    const key = normalizePath(path);
    await this.ensureParentDirs(key);
    const content =
      typeof data === "string" ? data : new TextDecoder().decode(data);
    await this.storePut(key, content);
  }

  async mkdir(path: string, _opts?: { recursive?: boolean }): Promise<void> {
    await this.ensureReady();
    const key = normalizePath(path);
    const existing = await this.storeGet(key);
    if (existing !== undefined) {
      throw new VfsError(`EEXIST: file already exists '${path}'`);
    }
    await this.assertParentExists(key);
    await this.storePut(key, DIR_MARKER);
  }

  async readdir(path: string): Promise<string[]> {
    await this.ensureReady();
    const key = normalizePath(path);
    const entry = await this.storeGet(key);
    if (entry === undefined) {
      throw new VfsError(`ENOENT: no such file or directory '${path}'`);
    }
    if (entry !== DIR_MARKER) {
      throw new VfsError(`ENOTDIR: not a directory '${path}'`);
    }
    const prefix = key === "/" ? "/" : `${key}/`;
    const keys = await this.storeKeys();
    const children = new Set<string>();
    for (const k of keys) {
      if (!k.startsWith(prefix) || k === key) continue;
      const rest = k.slice(prefix.length);
      const name = rest.split("/")[0];
      if (name) children.add(name);
    }
    return [...children].sort();
  }

  async unlink(path: string): Promise<void> {
    await this.ensureReady();
    const key = normalizePath(path);
    const entry = await this.storeGet(key);
    if (entry === undefined) {
      throw new VfsError(`ENOENT: no such file '${path}'`);
    }
    if (entry === DIR_MARKER) {
      throw new VfsError(`EISDIR: illegal operation on a directory '${path}'`);
    }
    await this.storeDelete(key);
  }

  async exists(path: string): Promise<boolean> {
    await this.ensureReady();
    const key = normalizePath(path);
    const entry = await this.storeGet(key);
    return entry !== undefined;
  }

  /** List all file paths (excluding directory markers). */
  async listAllFiles(): Promise<string[]> {
    await this.ensureReady();
    const keys = await this.storeKeys();
    const files: string[] = [];
    for (const k of keys) {
      const entry = await this.storeGet(k);
      if (entry !== undefined && entry !== DIR_MARKER) {
        files.push(k);
      }
    }
    return files.sort();
  }

  /** Build a nested tree structure for UI rendering. */
  async getTree(): Promise<FileTreeNode> {
    const keys = await this.storeKeys();
    const root: FileTreeNode = { name: "/", type: "dir", children: [] };

    const ensureDir = (
      node: FileTreeNode,
      parts: string[],
      idx: number,
    ): FileTreeNode => {
      if (idx >= parts.length) return node;
      const name = parts[idx];
      let child = node.children?.find((c) => c.name === name);
      if (!child) {
        child = { name, type: "dir", children: [] };
        node.children = node.children ?? [];
        node.children.push(child);
      }
      return ensureDir(child, parts, idx + 1);
    };

    for (const k of keys) {
      if (k === "/") continue;
      const parts = k.split("/").filter(Boolean);
      const entry = await this.storeGet(k);
      if (entry === DIR_MARKER) {
        ensureDir(root, parts, 0);
      } else {
        const parentParts = parts.slice(0, -1);
        const parent = ensureDir(root, parentParts, 0);
        parent.children = parent.children ?? [];
        parent.children.push({
          name: parts[parts.length - 1],
          type: "file",
          path: k,
        });
      }
    }

    const sortTree = (node: FileTreeNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
      }
    };
    sortTree(root);
    return root;
  }
}

export interface FileTreeNode {
  name: string;
  type: "file" | "dir";
  path?: string;
  children?: FileTreeNode[];
}
