export class HeartbeatManager {
  private interval: number;
  private timeout: number;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private onTimeout: () => void;
  private sendPing: () => void;

  constructor(
    sendPing: () => void,
    onTimeout: () => void,
    interval: number = 30000,
    timeout: number = 5000
  ) {
    this.sendPing = sendPing;
    this.onTimeout = onTimeout;
    this.interval = interval;
    this.timeout = timeout;
  }

  public start(): void {
    this.stop();
    this.pingTimer = setInterval(() => {
      this.sendPing();
      
      // Expect a pong within timeout
      this.pongTimer = setTimeout(() => {
        console.warn("WebSocket: Heartbeat timeout. Closing connection...");
        this.onTimeout();
      }, this.timeout);
    }, this.interval);
  }

  public acknowledge(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  public stop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
}
