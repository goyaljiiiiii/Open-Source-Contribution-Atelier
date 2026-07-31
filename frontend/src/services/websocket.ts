import { ReconnectManager } from "./reconnectManager";
import { HeartbeatManager } from "./heartbeat";

export interface WebSocketServiceOptions {
  url: string;
  token?: string | null;
  onMessage?: (data: unknown) => void;
  onStateChange?: (state: { isConnected: boolean; reconnectExhausted: boolean; error: Event | null }) => void;
  reconnectInterval?: number; // Base delay for reconnect manager
  maxReconnectAttempts?: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private options: WebSocketServiceOptions;
  private reconnectManager: ReconnectManager;
  private heartbeatManager: HeartbeatManager;
  private intentionalClose: boolean = false;
  private isConnected: boolean = false;
  private error: Event | null = null;

  constructor(options: WebSocketServiceOptions) {
    this.options = options;
    
    this.reconnectManager = new ReconnectManager(
      () => this.connect(),
      options.reconnectInterval || 1000, // starting backoff delay 1s
      30000, // max backoff 30s
      options.maxReconnectAttempts || 10
    );

    this.heartbeatManager = new HeartbeatManager(
      () => this.send({ type: "ping" }),
      () => this.handleHeartbeatTimeout(),
      30000, // interval 30s
      5000 // timeout 5s
    );
  }

  private buildUrl(): string {
    const { url, token } = this.options;
    if (!token) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }

  private notifyStateChange() {
    this.options.onStateChange?.({
      isConnected: this.isConnected,
      reconnectExhausted: this.reconnectManager.isExhausted,
      error: this.error,
    });
  }

  public connect(): void {
    this.cleanup();

    if (!this.options.token) {
      this.isConnected = false;
      this.notifyStateChange();
      return;
    }

    this.intentionalClose = false;
    const wsUrl = this.buildUrl();
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.error = null;
        this.reconnectManager.reset();
        this.heartbeatManager.start();
        this.notifyStateChange();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === "pong") {
            this.heartbeatManager.acknowledge();
            return;
          }
          this.options.onMessage?.(data);
        } catch (e) {
          console.error("WebSocketService: failed to parse message", event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.heartbeatManager.stop();
        this.notifyStateChange();

        if (this.intentionalClose) return;

        // Schedule reconnection on unexpected close
        this.reconnectManager.schedule();
        this.notifyStateChange(); // Update reconnectExhausted status
      };

      this.ws.onerror = (event) => {
        this.error = event;
        this.isConnected = false;
        this.notifyStateChange();
      };
    } catch (e) {
      console.error("WebSocketService: Failed to establish connection", e);
      this.reconnectManager.schedule();
    }
  }

  private handleHeartbeatTimeout() {
    // If pong is not received, forcefully terminate connection to trigger reconnect
    this.cleanup(false); // not intentional, will trigger onclose or reconnect
    this.reconnectManager.schedule();
    this.notifyStateChange();
  }

  public send(data: unknown): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  public disconnect(): void {
    this.cleanup(true);
    this.isConnected = false;
    this.reconnectManager.reset();
    this.notifyStateChange();
  }

  private cleanup(intentional: boolean = false): void {
    this.intentionalClose = intentional;
    this.heartbeatManager.stop();

    if (this.ws) {
      // Clear handlers to avoid memory leaks
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
