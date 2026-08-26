import { useEffect, useRef, useState } from "react";
import * as Comlink from "comlink";
import DOMPurify from "dompurify";
// KaTeX output references katex fonts/styles; load them wherever parsed HTML
// is displayed. Tree-shaken into the consuming route chunk.
import "katex/dist/katex.min.css";
import type { MarkdownWorkerApi } from "../workers/markdownWorker";
import { parseMarkdownToHtml } from "../workers/markdownParserCore";

type RemoteApi = Comlink.Remote<MarkdownWorkerApi>;

let cachedWorkerApi: RemoteApi | null | undefined;

async function getWorkerApi(): Promise<RemoteApi | null> {
  if (cachedWorkerApi !== undefined) return cachedWorkerApi;

  if (typeof window === "undefined" || typeof Worker === "undefined") {
    cachedWorkerApi = null;
    return cachedWorkerApi;
  }

  try {
    const worker = new Worker(
      new URL("../workers/markdownWorker.ts", import.meta.url),
      { type: "module" },
    );
    cachedWorkerApi = Comlink.wrap<MarkdownWorkerApi>(worker);
  } catch {
    cachedWorkerApi = null;
  }
  return cachedWorkerApi;
}

const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true, svg: true, mathMl: true },
  // KaTeX relies on inline styles and ARIA attributes for layout/accessibility.
  ALLOWED_ATTR: [
    "href",
    "src",
    "alt",
    "start",
    "class",
    "style",
    "aria-hidden",
    "encoding",
    "mathvariant",
  ],
} satisfies DOMPurify.Config;

function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

export interface UseMarkdownWorkerResult {
  /** Sanitized HTML ready for dangerouslySetInnerHTML. */
  html: string;
  /** True while a worker round-trip is in flight. */
  isParsing: boolean;
}

/**
 * Parses markdown off the main thread using `markdownWorker.ts` (comlink).
 * Falls back to parsing on the current thread when workers are unavailable
 * (e.g. during SSR/prerender). The result is sanitized with DOMPurify before
 * being returned, so it is safe to inject via dangerouslySetInnerHTML.
 */
export function useMarkdownWorker(content: string): UseMarkdownWorkerResult {
  const [html, setHtml] = useState(() => sanitizeHtml(""));
  const [isParsing, setIsParsing] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestIdRef.current;

    async function parse() {
      setIsParsing(true);
      try {
        const api = await getWorkerApi();
        let parsed: string;
        try {
          parsed = api
            ? await api.parse(content)
            : await parseMarkdownToHtml(content);
        } catch {
          parsed = await parseMarkdownToHtml(content);
        }
        if (cancelled || requestId !== requestIdRef.current) return;
        setHtml(sanitizeHtml(parsed));
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setIsParsing(false);
        }
      }
    }

    parse();
    return () => {
      cancelled = true;
    };
  }, [content]);

  return { html, isParsing };
}
