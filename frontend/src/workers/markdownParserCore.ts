/**
 * Framework-free markdown -> HTML parser used by the markdown Web Worker
 * (`markdownWorker.ts`). Kept dependency-light so it can also run on the main
 * thread as a fallback when workers are unavailable (SSR/prerender).
 *
 * Safety model: every dynamic fragment is HTML-escaped during generation
 * (workers have no DOM for DOMPurify), URLs are scheme-allowlisted, and the
 * consuming hook additionally sanitizes the result with DOMPurify.
 */

const SAFE_URL_PATTERN = /^(https?:\/\/|mailto:|\/|#)/i;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(url: string): string {
  const trimmed = url.trim();
  return SAFE_URL_PATTERN.test(trimmed) ? trimmed : "#";
}

type KatexModule = typeof import("katex");

let katexPromise: Promise<KatexModule> | null = null;

async function loadKatex(): Promise<KatexModule | null> {
  if (!katexPromise) {
    katexPromise = import("katex");
  }
  try {
    return await katexPromise;
  } catch {
    katexPromise = null;
    return null;
  }
}

interface MathSegment {
  display: boolean;
  tex: string;
}

interface ParseContext {
  codeSpans: string[];
  mathSegments: MathSegment[];
}

const NUL = String.fromCharCode(0);
const CODE_PLACEHOLDER_RE = new RegExp(`${NUL}C(\\d+)${NUL}`, "g");
const MATH_PLACEHOLDER_RE = new RegExp(`${NUL}M(\\d+)${NUL}`, "g");

/** Masks code spans / math into opaque placeholders that survive escaping. */
function maskInline(ctx: ParseContext, raw: string): string {
  let text = raw.replace(
    /(`+)([\s\S]*?)\1/g,
    (_match, _ticks: string, inner: string) => {
      ctx.codeSpans.push(inner);
      return `\u0000C${ctx.codeSpans.length - 1}\u0000`;
    },
  );

  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, tex: string) => {
    const trimmedTex = tex.trim();
    if (!trimmedTex) return _match;
    ctx.mathSegments.push({ display: true, tex: trimmedTex });
    return `\u0000M${ctx.mathSegments.length - 1}\u0000`;
  });

  text = text.replace(/\$([^$\n]+?)\$/g, (_match, tex: string) => {
    const trimmedTex = tex.trim();
    if (!trimmedTex || !/^\S([\s\S]*\S)?$/.test(trimmedTex)) return _match;
    ctx.mathSegments.push({ display: false, tex: trimmedTex });
    return `\u0000M${ctx.mathSegments.length - 1}\u0000`;
  });

  return text;
}

async function renderMathSegment(segment: MathSegment): Promise<string> {
  const katex = await loadKatex();
  if (katex) {
    try {
      return katex.renderToString(segment.tex, {
        throwOnError: false,
        displayMode: segment.display,
      });
    } catch {
      // fall through to plain-text fallback below
    }
  }
  const raw = segment.display ? `$$${segment.tex}$$` : `$${segment.tex}$`;
  return `<code>${escapeHtml(raw)}</code>`;
}

async function restorePlaceholders(
  ctx: ParseContext,
  html: string,
): Promise<string> {
  if (ctx.mathSegments.length > 0) {
    const rendered = await Promise.all(
      ctx.mathSegments.map((segment) => renderMathSegment(segment)),
    );
    html = html.replace(MATH_PLACEHOLDER_RE, (_match, index: string) => {
      return rendered[Number(index)] ?? "";
    });
  }

  return html.replace(CODE_PLACEHOLDER_RE, (_match, index: string) => {
    const rawCode = ctx.codeSpans[Number(index)] ?? "";
    return `<code class="rounded border border-black/20 px-1.5 py-0.5 font-mono text-sm dark:border-[#2e2924]">${escapeHtml(rawCode)}</code>`;
  });
}

/** Renders bold and links on already-escaped text. */
function decorateEscaped(escaped: string): string {
  let out = escaped.replace(
    /\*\*([^*]+)\*\*/g,
    (_match, inner: string) =>
      `<strong class="font-extrabold">${inner}</strong>`,
  );

  out = out.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)\)/g,
    (_match, label: string, href: string) => {
      const safeHref = escapeHtml(safeUrl(href));
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="font-bold underline transition-colors hover:text-accent">${label}</a>`;
    },
  );

  return out;
}

export async function renderInline(
  ctx: ParseContext,
  raw: string,
): Promise<string> {
  const masked = maskInline(ctx, raw);
  const escaped = escapeHtml(masked);
  const decorated = decorateEscaped(escaped);
  return restorePlaceholders(ctx, decorated);
}

const HEADING_CLASSES: Record<number, string> = {
  1: "mb-4 mt-6 text-3xl font-black",
  2: "mb-3 mt-6 border-b-2 border-black/10 pb-1 text-2xl font-black dark:border-[#2e2924]/30",
  3: "mb-2 mt-4 text-xl font-extrabold",
  4: "mb-2 mt-4 text-lg font-extrabold",
  5: "mb-2 mt-3 text-base font-extrabold",
  6: "mb-2 mt-3 text-sm font-extrabold",
};

const ALERT_STYLES: Record<string, { className: string; icon: string }> = {
  NOTE: {
    className:
      "border-black bg-surface-low text-text dark:border-[#2e2924] dark:bg-black/20 dark:text-[#c4bbae]",
    icon: "\u2139\uFE0F",
  },
  TIP: {
    className:
      "border-green-500 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300",
    icon: "\uD83D\uDCA1",
  },
  IMPORTANT: {
    className:
      "border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300",
    icon: "\u26A0\uFE0F",
  },
};
ALERT_STYLES.WARNING = ALERT_STYLES.IMPORTANT;
ALERT_STYLES.CAUTION = {
  className:
    "border-red-500 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300",
  icon: "\uD83D\uDEA8",
};

/** Splits a table row into cells, honouring escaped pipes (`\|`). */
export function splitTableRow(row: string): string[] {
  let trimmed = row.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|") && !trimmed.endsWith("\\|")) {
    trimmed = trimmed.slice(0, -1);
  }

  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i++;
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableSeparator(line: string): boolean {
  return line.includes("-") && /^[\s|:-]+$/.test(line);
}

/**
 * Parses a markdown document into an HTML string. Supports headings, bold,
 * inline code, links, fenced code blocks, GitHub alerts, blockquotes, tables,
 * ordered/unordered lists, images, horizontal rules and `$`/`$$` TeX math
 * (KaTeX, lazily imported only when math is actually present).
 */
export async function parseMarkdownToHtml(content: string): Promise<string> {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const ctx: ParseContext = { codeSpans: [], mathSegments: [] };
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // Fenced code blocks
    if (trimmed.startsWith("```")) {
      const langMatch = trimmed.match(/^```([a-zA-Z0-9_-]+)/);
      const lang = langMatch ? langMatch[1].toLowerCase() : "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing fence
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      html.push(
        `<div class="my-4 overflow-hidden rounded-2xl border-4 border-black bg-[#1a1510] shadow-card-sm dark:border-[#2e2924]"><pre class="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-[#ffebc2]"><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre></div>`,
      );
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const inner = await renderInline(ctx, headingMatch[2]);
      html.push(
        `<h${level} class="${HEADING_CLASSES[level]}">${inner}</h${level}>`,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^([-*_]\s*){3,}$/.test(trimmed)) {
      html.push(
        '<hr class="my-4 border-t-4 border-black/10 dark:border-[#2e2924]" />',
      );
      i++;
      continue;
    }

    // GitHub alerts: > [!NOTE], > [!TIP], ...
    const alertMatch = trimmed.match(
      /^>\s+\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i,
    );
    if (alertMatch) {
      const alertType = alertMatch[1].toUpperCase();
      const style = ALERT_STYLES[alertType] ?? ALERT_STYLES.NOTE;
      const quoteLines: string[] = [alertMatch[2]];
      i++;
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const inner = await renderInline(ctx, quoteLines.join(" ").trim());
      html.push(
        `<div class="my-4 flex items-start gap-3 rounded-2xl border-4 p-4 shadow-card-sm ${style.className}"><span class="shrink-0 text-xl">${style.icon}</span><div><strong class="mb-0.5 block text-xs uppercase tracking-wider">${alertType}</strong><p class="text-sm font-bold leading-relaxed">${inner}</p></div></div>`,
      );
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const inner = await renderInline(ctx, quoteLines.join(" ").trim());
      html.push(
        `<blockquote class="my-3 border-l-4 border-accent pl-4 font-bold italic text-muted dark:text-[#c4bbae]">${inner}</blockquote>`,
      );
      continue;
    }

    // Tables
    if (trimmed.startsWith("|")) {
      const headerCells = splitTableRow(lines[i]);
      i++;
      if (i < lines.length && isTableSeparator(lines[i])) {
        i++;
      }
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }

      const headHtml = (
        await Promise.all(
          headerCells.map(
            async (cell) =>
              `<th class="border-r-2 border-black px-4 py-3 text-xs uppercase tracking-wider last:border-r-0 dark:border-[#2e2924] dark:text-[#f0ebe2]">${await renderInline(ctx, cell)}</th>`,
          ),
        )
      ).join("");
      const rowsHtml = (
        await Promise.all(
          bodyRows.map(async (row) => {
            const cellsHtml = await Promise.all(
              row.map(
                async (cell) =>
                  `<td class="border-r-2 border-black px-4 py-3 last:border-r-0 dark:border-[#2e2924] dark:text-[#c4bbae]">${await renderInline(ctx, cell)}</td>`,
              ),
            );
            return `<tr class="border-b-2 border-black last:border-b-0 hover:bg-surface-lowest transition-colors dark:border-[#2e2924] dark:hover:bg-black/10">${cellsHtml.join("")}</tr>`;
          }),
        )
      ).join("");

      html.push(
        `<div class="my-4 overflow-x-auto rounded-2xl border-4 border-black shadow-card-sm dark:border-[#2e2924]"><table class="w-full border-collapse bg-white text-left text-sm font-bold dark:bg-[#1f1c18]"><thead><tr class="border-b-4 border-black bg-surface-low dark:border-[#2e2924] dark:bg-[#151411]">${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`,
      );
      continue;
    }

    // Unordered lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))
      ) {
        items.push(lines[i].trim().slice(2).trim());
        i++;
      }
      const itemsHtml = (
        await Promise.all(
          items.map(
            async (item) =>
              `<li class="text-sm font-bold leading-relaxed">${await renderInline(ctx, item)}</li>`,
          ),
        )
      ).join("");
      html.push(`<ul class="my-3 list-disc space-y-2 pl-4">${itemsHtml}</ul>`);
      continue;
    }

    // Ordered lists
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const start = parseInt(olMatch[1], 10);
      const items: string[] = [olMatch[2]];
      i++;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      const itemsHtml = (
        await Promise.all(
          items.map(
            async (item) =>
              `<li class="text-sm font-bold leading-relaxed">${await renderInline(ctx, item)}</li>`,
          ),
        )
      ).join("");
      const startAttr = start !== 1 ? ` start="${start}"` : "";
      html.push(
        `<ol class="my-3 list-decimal space-y-2 pl-4"${startAttr}>${itemsHtml}</ol>`,
      );
      continue;
    }

    // Standalone image lines
    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      const [, alt, src] = imageMatch;
      html.push(
        `<img src="${escapeHtml(safeUrl(src))}" alt="${escapeHtml(alt)}" loading="lazy" class="mx-auto my-4 max-w-full rounded-2xl border-4 border-black shadow-card-sm dark:border-[#2e2924]" />`,
      );
      i++;
      continue;
    }

    // Paragraph (container decides size/weight/color)
    const inner = await renderInline(ctx, line);
    html.push(`<p class="my-3 leading-relaxed">${inner}</p>`);
    i++;
  }

  return html.join("\n");
}
