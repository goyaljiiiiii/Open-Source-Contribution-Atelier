import React from "react";
import { Activity, Server, Code } from "lucide-react";
import { WebSocketSimulator } from "../components/docs/WebSocketSimulator";
import { CodeBlock } from "../components/docs/CodeBlock";

export function WebSocketSimulatorPage() {
  const consumerSnippet = `
# backend/apps/chat/consumers.py
import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"

        # Join channel layer group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave channel group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive_json(self, content):
        action = content.get("action")
        if action == "send_message":
            # Broadcast to channel layer group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": content.get("message"),
                    "sender": content.get("sender"),
                }
            )

    async def chat_message(self, event):
        # Dispatch event to WebSocket client
        await self.send_json({
            "type": "chat_message",
            "message": event["message"],
            "sender": event["sender"],
        })
`.trim();

  const reactHookSnippet = `
// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from "react";

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, data]);
    };

    return () => ws.close();
  }, [url]);

  const sendMessage = (payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  return { isConnected, messages, sendMessage };
}
`.trim();

  return (
    <div className="w-full min-h-screen bg-surface dark:bg-[#0a0a0f] text-text dark:text-[#f0ebe2] p-4 md:p-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b-2 border-black/10 dark:border-[#2e2924]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-text dark:text-[#f0ebe2] flex items-center gap-2">
              WebSocket Channel Flow Simulator
            </h1>
            <p className="text-sm font-medium text-muted dark:text-[#c4bbae] mt-1">
              Interactive protocol demonstration of real-time communication between React clients, Django Channels consumers, and Redis pub/sub.
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Simulator */}
      <WebSocketSimulator />

      {/* Protocol Explanation & Code References */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* Left Column: Django Channels Consumer Code */}
        <div className="p-5 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 text-base font-bold text-text dark:text-[#f0ebe2]">
            <Server className="w-5 h-5 text-purple-500" />
            Django Channels Async Consumer
          </div>
          <p className="text-xs text-muted dark:text-[#a0988c]">
            Consumers handle ASGI WebSocket connections asynchronously, parsing inbound frames and managing group subscriptions via <code className="font-mono text-purple-400">channel_layer.group_send()</code>.
          </p>

          <CodeBlock
            code={consumerSnippet}
            language="python"
            filename="backend/apps/chat/consumers.py"
            showLineNumbers={true}
          />
        </div>

        {/* Right Column: React Hook Code */}
        <div className="p-5 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 text-base font-bold text-text dark:text-[#f0ebe2]">
            <Code className="w-5 h-5 text-blue-500" />
            React Custom WebSocket Hook
          </div>
          <p className="text-xs text-muted dark:text-[#a0988c]">
            The frontend manages persistent WebSocket lifecycles with state tracking for active connection status, frame buffering, and auto-reconnect fallback.
          </p>

          <CodeBlock
            code={reactHookSnippet}
            language="typescript"
            filename="frontend/src/hooks/useWebSocket.ts"
            showLineNumbers={true}
          />
        </div>
      </div>
    </div>
  );
}

export default WebSocketSimulatorPage;
