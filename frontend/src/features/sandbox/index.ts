export { VirtualFileSystem, VfsError } from "./engine/virtualFileSystem";
export type { FileTreeNode } from "./engine/virtualFileSystem";

export { GitWasmEngine } from "./engine/gitWasmEngine";
export type { GitDagNode, GitStatusEntry } from "./engine/gitWasmEngine";

export { useGitSandbox } from "./hooks/useGitSandbox";
export type { TerminalLine, GitSandboxState } from "./hooks/useGitSandbox";

export { WASMTerminal } from "./components/WASMTerminal";
export { GitGraphVisualizer } from "./components/GitGraphVisualizer";
export { VirtualFileTree } from "./components/VirtualFileTree";
