import React, { useState } from "react";
import {
  Send,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  Key,
  Database,
  Globe,
} from "lucide-react";
import { API_BASE } from "../../lib/api";
import { getAccessToken } from "../../lib/authToken";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type TabType = "params" | "headers" | "auth" | "body";

interface ResponseData {
  status: number;
  statusText: string;
  data: any;
  latency: number;
  isJson: boolean;
  error?: string;
}

const methodColors: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

export function ApiExplorer() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [endpoint, setEndpoint] = useState<string>("/api/accounts/");
  const [activeTab, setActiveTab] = useState<TabType>("params");

  // Tab States
  const [queryParams, setQueryParams] = useState<string>("");
  const [headers, setHeaders] = useState<string>(
    '{\n  "Accept": "application/json"\n}',
  );
  const [bearerToken, setBearerToken] = useState<string>(
    getAccessToken() || "",
  );
  const [body, setBody] = useState<string>("{\n  \n}");

  // Response State
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);

  const handleSendRequest = async () => {
    setIsLoading(true);
    setResponse(null);
    const startTime = performance.now();

    try {
      // Parse Headers
      let parsedHeaders: Record<string, string> = {};
      try {
        if (headers.trim()) parsedHeaders = JSON.parse(headers);
      } catch {
        throw new Error("Invalid JSON in Headers");
      }

      // Add Authorization
      if (bearerToken.trim()) {
        parsedHeaders["Authorization"] = `Bearer ${bearerToken.trim()}`;
      }

      // Parse Body if needed
      let parsedBody: string | undefined = undefined;
      if (method !== "GET" && method !== "DELETE" && body.trim()) {
        try {
          JSON.parse(body); // Validate JSON
          parsedBody = body;
          parsedHeaders["Content-Type"] = "application/json";
        } catch {
          throw new Error("Invalid JSON in Body");
        }
      }

      // Construct URL
      let urlStr = `${API_BASE}${endpoint}`;
      if (queryParams.trim()) {
        const separator = urlStr.includes("?") ? "&" : "?";
        urlStr += `${separator}${queryParams.trim()}`;
      }

      const res = await fetch(urlStr, {
        method,
        headers: parsedHeaders,
        body: parsedBody,
      });

      const latency = Math.round(performance.now() - startTime);

      let data: any;
      let isJson = false;
      const contentType = res.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
        isJson = true;
      } else {
        data = await res.text();
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        latency,
        isJson,
      });
    } catch (err: any) {
      setResponse({
        status: 0,
        statusText: "Error",
        data: null,
        latency: Math.round(performance.now() - startTime),
        isJson: false,
        error: err.message || "Failed to fetch. Check CORS or network.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300)
      return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    if (status >= 400 && status < 500)
      return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30";
    if (status >= 500)
      return "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30";
    return "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30";
  };

  return (
    <div className="w-full flex flex-col gap-4 text-gray-900 dark:text-gray-100 font-sans">
      <div className="p-5 bg-white dark:bg-[#121622] border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col gap-4 shadow-sm">
        {/* URL Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold outline-none transition-colors ${methodColors[method]} bg-transparent focus:ring-2 focus:ring-blue-500/50`}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <div className="flex-1 w-full relative flex items-center">
            <Globe className="absolute left-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="/api/example/"
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#0b0e16] border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={handleSendRequest}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all"
          >
            {isLoading ? (
              <Clock className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Send</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0e16] overflow-x-auto">
            {(["params", "headers", "auth", "body"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-white dark:bg-[#121622] text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab === "auth" ? "Authorization" : tab}
              </button>
            ))}
          </div>

          <div className="p-4 bg-white dark:bg-[#121622] min-h-[120px]">
            {activeTab === "params" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Query String
                </label>
                <input
                  type="text"
                  value={queryParams}
                  onChange={(e) => setQueryParams(e.target.value)}
                  placeholder="limit=10&offset=20"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0e16] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {activeTab === "headers" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Headers (JSON)
                </label>
                <textarea
                  value={headers}
                  onChange={(e) => setHeaders(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0e16] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
                  placeholder='{ "Content-Type": "application/json" }'
                />
              </div>
            )}

            {activeTab === "auth" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Key className="w-3 h-3" /> Bearer Token
                </label>
                <input
                  type="text"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  placeholder="ey..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0e16] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-gray-400">
                  Token is automatically populated if you are logged in.
                </p>
              </div>
            )}

            {activeTab === "body" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Database className="w-3 h-3" /> JSON Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={method === "GET" || method === "DELETE"}
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0e16] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={
                    method === "GET" || method === "DELETE"
                      ? "Body not allowed for GET/DELETE"
                      : '{ "key": "value" }'
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Response Panel */}
      {response && (
        <div className="p-5 bg-white dark:bg-[#0e111a] border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col gap-4 shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              Response
            </h3>
            <div className="flex items-center gap-3">
              <span
                className={`px-2.5 py-1 rounded-md border text-xs font-bold flex items-center gap-1 ${getStatusBadge(response.status)}`}
              >
                {response.status >= 200 && response.status < 300 ? (
                  <CheckCircle className="w-3 h-3" />
                ) : response.status === 0 ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Info className="w-3 h-3" />
                )}
                {response.status === 0
                  ? "ERROR"
                  : `${response.status} ${response.statusText}`}
              </span>
              <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {response.latency} ms
              </span>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-[#07090f] border border-gray-200 dark:border-gray-800 rounded-xl p-4 overflow-auto max-h-96">
            {response.error ? (
              <div className="text-red-500 text-sm font-mono">
                {response.error}
              </div>
            ) : response.isJson ? (
              <pre className="text-xs font-mono text-gray-800 dark:text-emerald-300">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            ) : (
              <pre className="text-xs font-mono text-gray-800 dark:text-gray-300 whitespace-pre-wrap">
                {String(response.data)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApiExplorer;
