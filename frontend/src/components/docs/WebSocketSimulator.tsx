import React, { useState, useEffect, useRef } from "react";
import {
  Wifi,
  WifiOff,
  Send,
  Zap,
  Copy,
  Trash2,
  Check,
  Server,
  Layers,
  Smartphone,
  Terminal,
  Activity,
  Sparkles,
} from "lucide-react";
import { toast } from "react-hot-toast";

export interface WsFrameLog {
  id: string;
  timestamp: string;
  direction: "outbound" | "inbound" | "system";
  type: string;
  channel: string;
  data: Record<string, any>;
  stepDesc: string;
}

const CHANNELS = [
  { id: "chat", name: "Chat Room", url: "ws://localhost:8000/ws/chat/room-42/" },
  { id: "notifications", name: "Notification Stream", url: "ws://localhost:8000/ws/notifications/" },
  { id: "collab", name: "Live Code Collab", url: "ws://localhost:8000/ws/collab/session-789/" },
  { id: "sandbox", name: "Sandbox Terminal", url: "ws://localhost:8000/ws/sandbox/term-1/" },
];

export function WebSocketSimulator() {
  const [selectedChannel, setSelectedChannel] = useState(CHANNELS[0].id);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [messageInput, setMessageInput] = useState("Hello team! Reviewing PR #104");
  const [senderName, setSenderName] = useState("alex_dev");
  const [logs, setLogs] = useState<WsFrameLog[]>([]);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState<"client" | "consumer" | "redis" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const logContainerRef = useRef<HTMLDivElement>(null);

  const activeChannelObj = CHANNELS.find((c) => c.id === selectedChannel) || CHANNELS[0];

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (
    direction: "outbound" | "inbound" | "system",
    type: string,
    data: Record<string, any>,
    stepDesc: string,
  ) => {
    const newLog: WsFrameLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString().split("T")[1].slice(0, 12),
      direction,
      type,
      channel: activeChannelObj.url,
      data,
      stepDesc,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  const triggerAnimationSequence = (
    steps: { node: "client" | "consumer" | "redis"; step: number; action: () => void }[],
  ) => {
    steps.forEach((s, idx) => {
      setTimeout(() => {
        setActiveNode(s.node);
        setActiveStep(s.step);
        s.action();
      }, idx * 450);
    });

    setTimeout(() => {
      setActiveNode(null);
      setActiveStep(null);
    }, steps.length * 450 + 200);
  };

  // 1. CONNECT
  const handleConnect = () => {
    if (connectionStatus === "connected") return;
    setConnectionStatus("connecting");

    triggerAnimationSequence([
      {
        node: "client",
        step: 1,
        action: () => {
          addLog("outbound", "ws_connect", { url: activeChannelObj.url, headers: { Upgrade: "websocket" } }, "1. Client initiates HTTP 101 WebSocket Upgrade");
        },
      },
      {
        node: "consumer",
        step: 2,
        action: () => {
          addLog("system", "consumer_accept", { consumer: "ChatConsumer", scope: "websocket" }, "2. Django Channels accepts connection & authenticates JWT");
        },
      },
      {
        node: "redis",
        step: 3,
        action: () => {
          addLog("system", "channel_layer_group_add", { group: `chat_${selectedChannel}`, channel: "specific.channel!abc123" }, "3. Registered consumer in Redis Channel Layer group");
        },
      },
      {
        node: "client",
        step: 4,
        action: () => {
          setConnectionStatus("connected");
          addLog("inbound", "connection_established", { status: 101, message: "WebSocket connection ready" }, "4. Handshake complete: ws:// connected");
          toast.success(`Connected to ${activeChannelObj.name}`);
        },
      },
    ]);
  };

  // 2. DISCONNECT
  const handleDisconnect = () => {
    if (connectionStatus === "disconnected") return;

    triggerAnimationSequence([
      {
        node: "client",
        step: 1,
        action: () => {
          addLog("outbound", "ws_close", { code: 1000, reason: "Client initiated disconnect" }, "1. Client sends CLOSE frame");
        },
      },
      {
        node: "consumer",
        step: 2,
        action: () => {
          addLog("system", "consumer_disconnect", { consumer: "ChatConsumer" }, "2. Consumer calls disconnect(close_code=1000)");
        },
      },
      {
        node: "redis",
        step: 3,
        action: () => {
          addLog("system", "group_discard", { group: `chat_${selectedChannel}` }, "3. Removed from Redis channel group");
          setConnectionStatus("disconnected");
          toast.error("WebSocket disconnected");
        },
      },
    ]);
  };

  // 3. SEND MESSAGE
  const handleSendMessage = () => {
    if (connectionStatus !== "connected") {
      toast.error("Please connect WebSocket first!");
      return;
    }

    const payload = {
      action: "send_message",
      message: messageInput,
      sender: senderName,
      timestamp: new Date().toISOString(),
    };

    triggerAnimationSequence([
      {
        node: "client",
        step: 1,
        action: () => {
          addLog("outbound", "chat_message", payload, "1. Outbound WS Text Frame sent by React hook");
        },
      },
      {
        node: "consumer",
        step: 2,
        action: () => {
          addLog("system", "consumer_receive", { method: "receive_json()", payload }, "2. Consumer parses JSON and calls channel_layer.group_send()");
        },
      },
      {
        node: "redis",
        step: 3,
        action: () => {
          addLog("system", "redis_pubsub_broadcast", { group: `chat_${selectedChannel}`, event: "chat_message" }, "3. Redis Channel Layer publishes event to all channel workers");
        },
      },
      {
        node: "client",
        step: 4,
        action: () => {
          addLog("inbound", "chat_message", { ...payload, id: Math.floor(Math.random() * 10000) }, "4. Broadcast message delivered back to client(s)");
          toast.success("Frame delivered across channels layer!");
        },
      },
    ]);
  };

  // 4. TYPING INDICATOR
  const handleTypingIndicator = () => {
    if (connectionStatus !== "connected") {
      toast.error("Please connect WebSocket first!");
      return;
    }

    const payload = {
      action: "typing_indicator",
      user: senderName,
      is_typing: true,
    };

    triggerAnimationSequence([
      {
        node: "client",
        step: 1,
        action: () => {
          addLog("outbound", "typing_indicator", payload, "1. Client emits typing state event");
        },
      },
      {
        node: "consumer",
        step: 2,
        action: () => {
          addLog("system", "group_send_typing", { event: "user_typing" }, "2. Consumer relays ephemeral typing event");
        },
      },
      {
        node: "client",
        step: 3,
        action: () => {
          addLog("inbound", "user_typing", payload, "3. Ephemeral typing event received by channel subscribers");
        },
      },
    ]);
  };

  const handleCopyJson = (log: WsFrameLog) => {
    navigator.clipboard.writeText(JSON.stringify(log.data, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copied frame JSON payload!");
  };

  const filteredLogs = logs.filter((l) => {
    if (filterType === "outbound") return l.direction === "outbound";
    if (filterType === "inbound") return l.direction === "inbound";
    if (filterType === "system") return l.direction === "system";
    return true;
  });

  return (
    <div className="w-full flex flex-col gap-6 text-gray-100">
      {/* Top Protocol Control Panel */}
      <div className="p-5 bg-[#121622] border border-gray-800 rounded-2xl flex flex-col gap-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                connectionStatus === "connected"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : connectionStatus === "connecting"
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-red-500/15 border-red-500/30 text-red-400"
              }`}
            >
              <Wifi className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">WebSocket Protocol Controls</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full tracking-wider ${
                    connectionStatus === "connected"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : connectionStatus === "connecting"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
                      : "bg-gray-800 text-gray-400 border border-gray-700"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectionStatus === "connected"
                        ? "bg-emerald-400 animate-ping"
                        : connectionStatus === "connecting"
                        ? "bg-amber-400"
                        : "bg-gray-500"
                    }`}
                  ></span>
                  {connectionStatus}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {activeChannelObj.url}
              </p>
            </div>
          </div>

          {/* Channel Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-400">Endpoint:</label>
            <select
              value={selectedChannel}
              onChange={(e) => {
                setSelectedChannel(e.target.value);
                if (connectionStatus === "connected") {
                  handleDisconnect();
                }
              }}
              className="bg-[#0b0e16] border border-gray-700 text-gray-200 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {connectionStatus === "disconnected" ? (
            <button
              onClick={handleConnect}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <Wifi className="w-4 h-4" /> CONNECT (Handshake)
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <WifiOff className="w-4 h-4" /> DISCONNECT
            </button>
          )}

          <button
            onClick={handleSendMessage}
            disabled={connectionStatus !== "connected"}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" /> SEND_MESSAGE
          </button>

          <button
            onClick={handleTypingIndicator}
            disabled={connectionStatus !== "connected"}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Zap className="w-4 h-4" /> TYPING_INDICATOR
          </button>

          <button
            onClick={() => {
              setLogs([]);
              toast.success("Cleared inspector frame log");
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b0e16] hover:bg-[#161a28] border border-gray-700 text-gray-300 font-semibold text-xs rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" /> Clear Frame Log
          </button>
        </div>

        {/* Message Input Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div>
            <label className="text-gray-400 font-bold uppercase text-[10px] block mb-1">
              Sender Username
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full bg-[#0b0e16] border border-gray-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-gray-400 font-bold uppercase text-[10px] block mb-1">
              Simulated Message Payload
            </label>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="w-full bg-[#0b0e16] border border-gray-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 3-Node Topology Flow Diagram */}
      <div className="p-6 bg-[#0e111a] border border-gray-800 rounded-2xl flex flex-col gap-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
            <Activity className="w-4 h-4 text-blue-400" /> Sequence Architecture Topology Diagram
          </div>
          {activeStep && (
            <span className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-mono font-bold animate-pulse">
              Executing Step #{activeStep}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative py-4">
          {/* Node 1: Client React App */}
          <div
            className={`p-4 rounded-xl border flex flex-col items-center text-center gap-2 transition-all ${
              activeNode === "client"
                ? "bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20 scale-105"
                : "bg-[#141824] border-gray-800 text-gray-400"
            }`}
          >
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-white">Client React App</h4>
            <p className="text-[10px] font-mono text-gray-400">
              useWebSocket() Hook
            </p>
            <span className="text-[9px] px-2 py-0.5 rounded bg-black/40 text-blue-300 font-mono">
              Browser WS Client
            </span>
          </div>

          {/* Node 2: Django Channels Consumer */}
          <div
            className={`p-4 rounded-xl border flex flex-col items-center text-center gap-2 transition-all ${
              activeNode === "consumer"
                ? "bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/20 scale-105"
                : "bg-[#141824] border-gray-800 text-gray-400"
            }`}
          >
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <Server className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-white">Django Channels</h4>
            <p className="text-[10px] font-mono text-gray-400">
              consumers.py (AsyncJsonWebsocketConsumer)
            </p>
            <span className="text-[9px] px-2 py-0.5 rounded bg-black/40 text-purple-300 font-mono">
              ASGI Application Server
            </span>
          </div>

          {/* Node 3: Redis Channel Layer */}
          <div
            className={`p-4 rounded-xl border flex flex-col items-center text-center gap-2 transition-all ${
              activeNode === "redis"
                ? "bg-amber-600/20 border-amber-500 shadow-lg shadow-amber-500/20 scale-105"
                : "bg-[#141824] border-gray-800 text-gray-400"
            }`}
          >
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
              <Layers className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-white">Redis Channel Layer</h4>
            <p className="text-[10px] font-mono text-gray-400">
              channels_redis (group_send PubSub)
            </p>
            <span className="text-[9px] px-2 py-0.5 rounded bg-black/40 text-amber-300 font-mono">
              Multi-Worker Fan-Out
            </span>
          </div>
        </div>
      </div>

      {/* Live Event Log Window & JSON Frame Inspector */}
      <div className="p-5 bg-[#0e111a] border border-gray-800 rounded-2xl flex flex-col gap-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Terminal className="w-4 h-4 text-emerald-400" /> Real-Time Frame Inspector Log
            <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full text-[10px] font-mono">
              {filteredLogs.length} events
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 text-[11px]">
            {["all", "outbound", "inbound", "system"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-2.5 py-1 rounded-md capitalize font-semibold transition-all ${
                  filterType === f
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white bg-[#141824]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Frame Log Area */}
        <div
          ref={logContainerRef}
          className="h-80 bg-[#07090f] border border-gray-800 rounded-xl p-4 overflow-y-auto space-y-3 font-mono text-xs"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs gap-2">
              <Sparkles className="w-6 h-6 opacity-40" />
              <span>No frames logged yet. Click CONNECT or SEND_MESSAGE to simulate WebSocket traffic.</span>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-[#111420] border border-gray-800/80 rounded-lg flex flex-col gap-2 hover:border-gray-700 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{log.timestamp}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-extrabold uppercase text-[10px] tracking-wider ${
                        log.direction === "outbound"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : log.direction === "inbound"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      }`}
                    >
                      {log.direction === "outbound"
                        ? "OUTBOUND ↗"
                        : log.direction === "inbound"
                        ? "INBOUND ↘"
                        : "SYSTEM ⚡"}
                    </span>
                    <span className="text-gray-300 font-semibold">{log.type}</span>
                  </div>

                  <button
                    onClick={() => handleCopyJson(log)}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-black/40 hover:bg-black/60 transition-colors"
                  >
                    {copiedId === log.id ? (
                      <Check className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedId === log.id ? "Copied" : "Copy JSON"}
                  </button>
                </div>

                <p className="text-xs text-gray-400 font-sans italic">{log.stepDesc}</p>

                <pre className="text-[11px] text-emerald-300 bg-[#07080d] p-2.5 rounded border border-gray-800/60 overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default WebSocketSimulator;
