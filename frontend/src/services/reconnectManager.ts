export class ReconnectManager {
  private baseDelay: number;
  private maxDelay: number;
  private maxAttempts: number;
  private attempt: number = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callback: () => void;

  constructor(
    callback: () => void,
    baseDelay: number = 1000,
    maxDelay: number = 30000,
    maxAttempts: number = 10
  ) {
    this.callback = callback;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.maxAttempts = maxAttempts;
  }

  public schedule(): void {
    this.clear();
    if (this.attempt >= this.maxAttempts) {
      console.warn("WebSocket: max reconnect attempts reached");
      return;
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt),
      this.maxDelay
    );

    this.attempt++;
    console.log(`WebSocket: reconnecting in ${delay}ms... (attempt ${this.attempt})`);
    this.timer = setTimeout(() => {
      this.callback();
    }, delay);
  }

  public reset(): void {
    this.clear();
    this.attempt = 0;
  }

  public clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public get isExhausted(): boolean {
    return this.attempt >= this.maxAttempts;
  }
}
