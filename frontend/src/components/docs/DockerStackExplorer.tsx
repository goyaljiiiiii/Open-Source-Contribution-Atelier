import { useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeProps
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Database, Server, AppWindow, HardDrive, Terminal, X, Play, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ServiceData = {
  id: string;
  name: string;
  type: "frontend" | "backend" | "db" | "redis";
  port: number;
  env: string[];
  healthcheck: string;
  dockerfile: string;
};

const SERVICES: Record<string, ServiceData> = {
  frontend: {
    id: "frontend",
    name: "Vite SPA",
    type: "frontend",
    port: 5173,
    env: ["VITE_API_URL"],
    healthcheck: "curl -f http://localhost:5173/",
    dockerfile: "node:20-alpine (Multi-stage)",
  },
  backend: {
    id: "backend",
    name: "Django API",
    type: "backend",
    port: 8000,
    env: ["DATABASE_URL", "REDIS_URL", "SECRET_KEY"],
    healthcheck: "curl -f http://localhost:8000/api/health/",
    dockerfile: "python:3.9-slim (Multi-stage)",
  },
  db: {
    id: "db",
    name: "Postgres Database",
    type: "db",
    port: 5432,
    env: ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"],
    healthcheck: "pg_isready -U user",
    dockerfile: "postgres:15-alpine",
  },
  redis: {
    id: "redis",
    name: "Redis Cache",
    type: "redis",
    port: 6379,
    env: [],
    healthcheck: "redis-cli ping",
    dockerfile: "redis:7-alpine",
  },
};

const ICONS = {
  frontend: AppWindow,
  backend: Server,
  db: Database,
  redis: HardDrive,
};

function ServiceNode({ data, selected }: NodeProps<Node<ServiceData>>) {
  const Icon = ICONS[data.type];
  
  return (
    <div className={`px-4 py-3 shadow-md rounded-xl border-2 bg-surface dark:bg-[#12121a] transition-colors ${selected ? "border-primary" : "border-black/10 dark:border-white/10"}`}>
      {data.id !== "frontend" && <Handle type="target" position={Position.Top} className="w-3 h-3 bg-primary" />}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-primary">
          <Icon size={20} />
        </div>
        <div>
          <div className="font-bold text-sm">{data.name}</div>
          <div className="text-xs text-muted dark:text-[#c4bbae]">:{data.port}</div>
        </div>
      </div>
      {data.id !== "db" && data.id !== "redis" && <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />}
    </div>
  );
}

const nodeTypes = { service: ServiceNode };

const initialNodes: Node<ServiceData>[] = [
  { id: "frontend", type: "service", position: { x: 250, y: 50 }, data: SERVICES.frontend },
  { id: "backend", type: "service", position: { x: 250, y: 200 }, data: SERVICES.backend },
  { id: "db", type: "service", position: { x: 100, y: 350 }, data: SERVICES.db },
  { id: "redis", type: "service", position: { x: 400, y: 350 }, data: SERVICES.redis },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "frontend", target: "backend", animated: true, style: { stroke: "#888" } },
  { id: "e2", source: "backend", target: "db", animated: true, style: { stroke: "#888" } },
  { id: "e3", source: "backend", target: "redis", animated: true, style: { stroke: "#888" } },
];

export function DockerStackExplorer() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selectedService, setSelectedService] = useState<ServiceData | null>(null);

  const [cmdAction, setCmdAction] = useState<"up" | "exec" | "logs">("up");
  const [cmdTarget, setCmdTarget] = useState<string>("backend");
  const [copied, setCopied] = useState(false);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedService(node.data as ServiceData);
  }, []);

  const generatedCommand = () => {
    switch (cmdAction) {
      case "up":
        return `docker compose up --build ${cmdTarget}`;
      case "exec":
        return `docker compose exec ${cmdTarget} sh`;
      case "logs":
        return `docker compose logs -f ${cmdTarget}`;
      default:
        return "";
    }
  };

  const copyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-black/10 bg-surface shadow-sm dark:border-white/10 dark:bg-[#12121a] overflow-hidden flex flex-col md:flex-row h-[600px]">
        
        {/* Diagram Area */}
        <div className="flex-1 relative h-full bg-slate-50 dark:bg-black/50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="w-full h-full"
          >
            <Background color="#ccc" gap={16} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Drawer Area */}
        <AnimatePresence>
          {selectedService && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-black/10 dark:border-white/10 bg-surface dark:bg-[#12121a] overflow-hidden flex flex-col"
            >
              <div className="w-[320px] h-full flex flex-col">
                <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-black/5 dark:bg-white/5">
                  <h3 className="font-bold flex items-center gap-2">
                    <Terminal size={18} /> Service Details
                  </h3>
                  <button onClick={() => setSelectedService(null)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded">
                    <X size={18} />
                  </button>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-muted dark:text-[#c4bbae] mb-2 uppercase tracking-wider">Identity</h4>
                    <div className="font-mono text-sm px-3 py-2 bg-black/5 dark:bg-white/10 rounded border border-black/10 dark:border-white/10">
                      {selectedService.id}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-muted dark:text-[#c4bbae] mb-2 uppercase tracking-wider">Exposed Port</h4>
                    <div className="font-mono text-sm px-3 py-2 bg-black/5 dark:bg-white/10 rounded border border-black/10 dark:border-white/10">
                      :{selectedService.port}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-muted dark:text-[#c4bbae] mb-2 uppercase tracking-wider">Environment</h4>
                    {selectedService.env.length > 0 ? (
                      <ul className="space-y-1">
                        {selectedService.env.map(e => (
                          <li key={e} className="font-mono text-xs px-2 py-1 bg-black/5 dark:bg-white/10 rounded inline-block mr-2 mb-2 border border-black/10 dark:border-white/10">{e}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted">No external bindings</div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-muted dark:text-[#c4bbae] mb-2 uppercase tracking-wider">Healthcheck</h4>
                    <div className="font-mono text-xs px-3 py-2 bg-black/5 dark:bg-white/10 rounded border border-black/10 dark:border-white/10 break-all">
                      {selectedService.healthcheck}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-muted dark:text-[#c4bbae] mb-2 uppercase tracking-wider">Dockerfile</h4>
                    <div className="font-mono text-xs px-3 py-2 bg-black/5 dark:bg-white/10 rounded border border-black/10 dark:border-white/10">
                      {selectedService.dockerfile}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Command Builder */}
      <div className="rounded-xl border border-black/10 bg-surface p-5 shadow-sm dark:border-white/10 dark:bg-[#12121a]">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Terminal size={20} /> Command Builder
        </h3>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-muted">Action</label>
            <select 
              value={cmdAction} 
              onChange={e => setCmdAction(e.target.value as any)}
              className="w-full rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20"
            >
              <option value="up">Start & Build (up --build)</option>
              <option value="exec">Shell Access (exec sh)</option>
              <option value="logs">View Logs (logs -f)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-muted">Service</label>
            <select 
              value={cmdTarget} 
              onChange={e => setCmdTarget(e.target.value)}
              className="w-full rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20"
            >
              {Object.keys(SERVICES).map(key => (
                <option key={key} value={key}>{SERVICES[key].name} ({key})</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg bg-black/5 p-4 text-sm font-mono text-text dark:bg-white/10 dark:text-[#f0ebe2] border border-black/10 dark:border-white/10">
            {generatedCommand()}
          </pre>
          <button 
            onClick={() => copyCommand(generatedCommand())}
            className="absolute top-2 right-2 p-2 rounded-md bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2 text-xs font-semibold"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-4 flex gap-4">
          <button 
            onClick={() => copyCommand("docker compose down -v")}
            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold underline underline-offset-2 flex items-center gap-1"
          >
            <Play size={12} /> prune all volumes (down -v)
          </button>
        </div>
      </div>
    </div>
  );
}
