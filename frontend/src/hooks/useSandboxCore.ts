import { useState, useRef, useEffect, useCallback } from "react";

export const SANDBOX_SOUND_PREF_KEY = "sandbox_sound_enabled";

export function isSandboxSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SANDBOX_SOUND_PREF_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setSandboxSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SANDBOX_SOUND_PREF_KEY, String(enabled));
  } catch {
    // Storage unavailable (private mode, etc.) — preference just won't persist
  }
}

function playSandboxSound(type: "success" | "error"): void {
  if (!isSandboxSoundEnabled()) return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "success") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
    osc.onended = () => void ctx.close();
  } catch {
    // Audio playback is best-effort (autoplay policies, unsupported browsers)
  }
}

export function useSandboxCore(createWorker: () => Worker) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const initWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    workerRef.current = createWorker();
    setIsReady(true);
  }, [createWorker]);

  useEffect(() => {
    initWorker();
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [initWorker]);

  const executeCode = useCallback(
    <TResult>(
      messageData: Record<string, unknown>,
      timeoutMs: number,
      extractResult: (data: unknown) => TResult,
      timeoutResult: TResult,
    ): Promise<TResult> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve(timeoutResult);
          return;
        }

        setIsExecuting(true);
        const executionId = Date.now().toString();

        const handleMessage = (event: MessageEvent) => {
          if (event.data.id === executionId) {
            cleanup();
            const result = extractResult(event.data);
            const error =
              result && typeof result === "object" && "error" in result
                ? result.error
                : null;
            playSandboxSound(error ? "error" : "success");
            resolve(result);
          }
        };

        const cleanup = () => {
          if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          if (workerRef.current) {
            workerRef.current.removeEventListener("message", handleMessage);
          }
          setIsExecuting(false);
        };

        workerRef.current.addEventListener("message", handleMessage);

        timeoutRef.current = window.setTimeout(() => {
          cleanup();
          initWorker();
          resolve(timeoutResult);
        }, timeoutMs);

        workerRef.current.postMessage({ id: executionId, ...messageData });
      });
    },
    [initWorker],
  );

  return { executeCode, isExecuting, isReady, workerRef, initWorker };
}
