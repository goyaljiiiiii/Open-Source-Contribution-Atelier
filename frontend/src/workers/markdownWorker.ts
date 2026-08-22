import * as Comlink from "comlink";
import { parseMarkdownToHtml } from "./markdownParserCore";

const api = {
  parse: parseMarkdownToHtml,
};

export type MarkdownWorkerApi = typeof api;

Comlink.expose(api);
