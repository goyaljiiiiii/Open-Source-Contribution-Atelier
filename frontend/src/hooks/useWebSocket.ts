import { useEffect, useRef, useCallback, useState } from "react";
import { WebSocketService } from "../services/websocket";

type UseWebSocketOptions = {
  url: string;
  token?: string | null;
  onMessage?: (data: unknown) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
};

type WebSocketState = {
  isConnected: boolean;
  /** True after max reconnect attempts fail — callers should use REST fallback */
  reconnectExhausted: boolean;
  lastMessage: unknown | null;
  error: Event | null;
};

export function useWebSocket({
  url,
  token,
  onMessage,
  reconnectInterval = 1000,
  maxReconnectAttempts = 10,
}: UseWebSocketOptions) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    reconnectExhausted: false,
    lastMessage: null,
    error: null,
  });

  const onMessageRef = useRef(onMessage);
  const serviceRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new WebSocketService({
        url,
        token,
        reconnectInterval,
        maxReconnectAttempts,
        onMessage: (data) => {
          setState((s) => ({ ...s, lastMessage: data }));
          onMessageRef.current?.(data);
        },
        onStateChange: (newState) => {
          setState((s) => ({
            ...s,
            isConnected: newState.isConnected,
            reconnectExhausted: newState.reconnectExhausted,
            error: newState.error,
          }));
        },
      });
    }

    // Connect whenever url or token changes
    // (Service internally checks if token is present)
    serviceRef.current.connect();

    return () => {
      serviceRef.current?.disconnect();
    };
  }, [url, token, reconnectInterval, maxReconnectAttempts]);

  const send = useCallback((data: unknown): boolean => {
    return serviceRef.current?.send(data) ?? false;
  }, []);

  const connect = useCallback(() => {
    serviceRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
  }, []);

  return {
    ...state,
    send,
    connect,
    disconnect,
  };
}
