/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { 
  Search, 
  Loader2, 
  Key, 
  Globe, 
  AlertCircle, 
  Cpu, 
  Copy, 
  Check, 
  Moon, 
  Sun, 
  Monitor, 
  Terminal, 
  X, 
  Play, 
  RefreshCw,
  Sparkles,
  Zap,
  Server,
  Cloud,
  HelpCircle,
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { AIModel } from "./types";

type Theme = "system" | "light" | "dark";
type ConnectionMode = "auto" | "server" | "direct" | "cors-proxy";

interface ProviderPreset {
  name: string;
  baseUrl: string;
  endpoint: string;
  chatEndpoint: string;
  requiresKey: boolean;
  placeholderKey: string;
  notes?: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    endpoint: "/v1/models",
    chatEndpoint: "/v1/chat/completions",
    requiresKey: true,
    placeholderKey: "sk-...",
  },
  {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    endpoint: "/v1/models",
    chatEndpoint: "/v1/messages",
    requiresKey: true,
    placeholderKey: "sk-ant-...",
    notes: "Direct browser requests to Anthropic require a CORS proxy or Server mode.",
  },
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai",
    endpoint: "/v1/models",
    chatEndpoint: "/v1/chat/completions",
    requiresKey: true,
    placeholderKey: "gsk_...",
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    endpoint: "/v1/models",
    chatEndpoint: "/v1/chat/completions",
    requiresKey: true,
    placeholderKey: "sk-or-...",
  },
  {
    name: "Mistral",
    baseUrl: "https://api.mistral.ai",
    endpoint: "/v1/models",
    chatEndpoint: "/v1/chat/completions",
    requiresKey: true,
    placeholderKey: "...",
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    endpoint: "/v1/models",
    chatEndpoint: "/v1/chat/completions",
    requiresKey: true,
    placeholderKey: "sk-...",
  },
  {
    name: "Together AI",
    baseUrl: "https://api.together.xyz",
    endpoint: "/v1/models",
    chatEndpoint: "/v1/chat/completions",
    requiresKey: true,
    placeholderKey: "...",
  },
  {
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434",
    endpoint: "/v1/models",
    chatEndpoint: "/v1/chat/completions",
    requiresKey: false,
    placeholderKey: "Not required for local",
  },
];

function safeGetStorage(key: string, fallback: string): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem(key) || fallback;
    }
  } catch (e) {
    // Sandboxed iframe protection
  }
  return fallback;
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, value);
    }
  } catch (e) {
    // Sandboxed iframe protection
  }
}

async function safeCopyText(text: string): Promise<boolean> {
  try {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // Fallback
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    return false;
  }
}

function ModelCard({ model, onTest }: { model: AIModel; onTest: (id: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await safeCopyText(model.id);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      id={`model-card-${model.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
      className="group bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500 transition-all flex items-center justify-between"
    >
      <div className="flex flex-col min-w-0 pr-2">
        <span className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={model.id}>
          {model.id}
        </span>
        {model.owned_by && (
          <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {model.owned_by}
          </span>
        )}
      </div>
      <div className="flex items-center space-x-1 shrink-0">
        <button
          id={`btn-test-${model.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
          type="button"
          onClick={() => onTest(model.id)}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition-all outline-none"
          title="Test Model"
        >
          <Terminal className="w-4 h-4" />
        </button>
        <button
          id={`btn-copy-${model.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
          type="button"
          onClick={handleCopy}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition-all outline-none"
          title="Copy Model ID"
        >
          {copied ? <Check className="w-4 h-4 text-green-500 dark:text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// Error Boundary for crash resilience
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Application Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {this.state.error?.message || "An unexpected error occurred while loading the view."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (safeGetStorage("theme", "system") as Theme) || "system";
  });

  const [mode, setMode] = useState<ConnectionMode>(() => {
    return (safeGetStorage("connection_mode", "auto") as ConnectionMode) || "auto";
  });

  const [customProxyUrl, setCustomProxyUrl] = useState("https://corsproxy.io/?");
  const [showDeploymentHelp, setShowDeploymentHelp] = useState(false);
  const [methodNotAllowedAlert, setMethodNotAllowedAlert] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;

    const applyTheme = () => {
      let isDark = theme === "dark";
      if (theme === "system") {
        try {
          isDark = Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
        } catch (e) {
          isDark = false;
        }
      }
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme();
    safeSetStorage("theme", theme);

    if (theme === "system" && typeof window !== "undefined" && window.matchMedia) {
      try {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => applyTheme();
        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener("change", handleChange);
          return () => mediaQuery.removeEventListener("change", handleChange);
        } else if ((mediaQuery as any).addListener) {
          (mediaQuery as any).addListener(handleChange);
          return () => (mediaQuery as any).removeListener(handleChange);
        }
      } catch (e) {
        // Safe fallback
      }
    }
  }, [theme]);

  const [baseUrl, setBaseUrl] = useState("https://api.openai.com");
  const [endpoint, setEndpoint] = useState("/v1/models");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [testModelId, setTestModelId] = useState<string | null>(null);
  const [chatEndpoint, setChatEndpoint] = useState("/v1/chat/completions");
  const [prompt, setPrompt] = useState("Hello! Explain what kind of model you are in one sentence.");
  const [testResponse, setTestResponse] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const applyPreset = (preset: ProviderPreset) => {
    setBaseUrl(preset.baseUrl);
    setEndpoint(preset.endpoint);
    setChatEndpoint(preset.chatEndpoint);
    setError(null);
    setMethodNotAllowedAlert(false);
  };

  const handleModeChange = (newMode: ConnectionMode) => {
    setMode(newMode);
    safeSetStorage("connection_mode", newMode);
    setMethodNotAllowedAlert(false);
  };

  /**
   * Performs direct client-side fetch from browser
   */
  const performDirectFetchModels = async (targetUrl: string, key: string) => {
    let finalUrl = targetUrl;
    if (mode === "cors-proxy" && customProxyUrl.trim()) {
      finalUrl = `${customProxyUrl.trim()}${encodeURIComponent(targetUrl)}`;
    }

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    if (key.trim()) {
      headers["Authorization"] = `Bearer ${key.trim()}`;
      headers["x-api-key"] = key.trim();
      headers["api-key"] = key.trim();
    }

    if (targetUrl.includes("anthropic.com") || targetUrl.includes("/v1/models")) {
      headers["anthropic-version"] = "2023-06-01";
      headers["dangerously-allow-browser"] = "true";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(finalUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Direct fetch received non-JSON response (HTTP ${response.status}): ${text.substring(0, 160)}`);
    }

    if (!response.ok) {
      const msg = data?.error?.message || data?.error || `HTTP ${response.status}: ${text.substring(0, 200)}`;
      throw new Error(msg);
    }

    return data;
  };

  /**
   * Main fetch models controller supporting Auto, Server Proxy, Direct Browser, and CORS proxy
   */
  const fetchModels = async (e?: React.FormEvent, overrideMode?: ConnectionMode) => {
    if (e) e.preventDefault();
    if (!baseUrl.trim() || !endpoint.trim()) return;

    setIsLoading(true);
    setError(null);
    setModels([]);
    setMethodNotAllowedAlert(false);

    const cleanBase = baseUrl.trim().replace(/\/$/, "");
    const cleanEndpoint = endpoint.trim().startsWith("/") ? endpoint.trim() : `/${endpoint.trim()}`;
    const fullTargetUrl = `${cleanBase}${cleanEndpoint}`;
    const currentMode = overrideMode || mode;

    try {
      let data: any = null;

      if (currentMode === "direct" || currentMode === "cors-proxy") {
        data = await performDirectFetchModels(fullTargetUrl, apiKey);
      } else {
        // "auto" or "server": Try server endpoint first
        let response: Response;
        try {
          response = await fetch("/api/fetch-models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: fullTargetUrl, apiKey: apiKey.trim() }),
          });
        } catch (networkErr: any) {
          // If network failed to reach /api and mode is auto, fall back to direct
          if (currentMode === "auto") {
            console.warn("Backend /api not reachable, falling back to direct browser mode:", networkErr);
            data = await performDirectFetchModels(fullTargetUrl, apiKey);
            handleModeChange("direct");
            return;
          }
          throw networkErr;
        }

        // Check for 405 Method Not Allowed or 404 Not Found (common on static Cloudflare Workers/Pages)
        if (response.status === 405 || response.status === 404) {
          if (currentMode === "auto") {
            // Auto fallback to direct browser fetch
            setMethodNotAllowedAlert(true);
            try {
              data = await performDirectFetchModels(fullTargetUrl, apiKey);
              handleModeChange("direct");
            } catch (directErr: any) {
              setMethodNotAllowedAlert(true);
              throw new Error(
                `Server returned HTTP ${response.status} (Static host / Cloudflare Worker detected with no backend endpoint).\nDirect fallback failed: ${directErr.message}`
              );
            }
          } else {
            setMethodNotAllowedAlert(true);
            throw new Error(
              `HTTP 405 (Method Not Allowed) received from host. The static server cannot process POST /api/fetch-models. Switch to 'Direct Browser Mode' or deploy Cloudflare Functions.`
            );
          }
        } else {
          const text = await response.text();
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error(`Server returned invalid JSON (Status ${response.status}): ${text.substring(0, 160)}`);
          }

          if (!response.ok) {
            throw new Error(data?.error || `Failed to fetch models (Status ${response.status})`);
          }
        }
      }

      // Parse and normalize returned models
      let parsedModels: any[] = [];
      if (data && Array.isArray(data.data)) {
        parsedModels = data.data;
      } else if (Array.isArray(data)) {
        parsedModels = data;
      } else if (data && typeof data === "object") {
        const possibleArray = Object.values(data).find(Array.isArray);
        if (possibleArray) {
          parsedModels = possibleArray as any[];
        } else if (data.id || data.name) {
          parsedModels = [data];
        }
      }

      const sanitized: AIModel[] = parsedModels
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          ...m,
          id: String(m.id || m.name || m.model || "unknown-model"),
        }));

      if (sanitized.length === 0) {
        setError(`No model items found in response. Response contained keys: ${Object.keys(data || {}).join(", ")}`);
      } else {
        sanitized.sort((a, b) => a.id.localeCompare(b.id));
        setModels(sanitized);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while fetching models.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Run Test Model
   */
  const runTest = async () => {
    if (!testModelId || !baseUrl || !chatEndpoint || !prompt) return;
    setIsTesting(true);
    setTestError(null);
    setTestResponse(null);

    const cleanBase = baseUrl.trim().replace(/\/$/, "");
    const cleanEndpoint = chatEndpoint.trim().startsWith("/") ? chatEndpoint.trim() : `/${chatEndpoint.trim()}`;
    const targetUrl = `${cleanBase}${cleanEndpoint}`;

    try {
      let data: any = null;

      if (mode === "direct" || mode === "cors-proxy") {
        // Direct browser test
        let finalUrl = targetUrl;
        if (mode === "cors-proxy" && customProxyUrl.trim()) {
          finalUrl = `${customProxyUrl.trim()}${encodeURIComponent(targetUrl)}`;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "application/json",
        };

        if (apiKey.trim()) {
          headers["Authorization"] = `Bearer ${apiKey.trim()}`;
          headers["x-api-key"] = apiKey.trim();
        }

        let payload: any;
        if (chatEndpoint.includes("messages")) {
          headers["anthropic-version"] = "2023-06-01";
          headers["dangerously-allow-browser"] = "true";
          payload = {
            model: testModelId,
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          };
        } else {
          payload = {
            model: testModelId,
            messages: [{ role: "user", content: prompt }],
          };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(finalUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const text = await response.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          throw new Error(`Invalid JSON response: ${text.substring(0, 150)}`);
        }

        if (!response.ok) {
          throw new Error(parsed?.error?.message || parsed?.error || `HTTP ${response.status}`);
        }

        data = { ok: true, status: response.status, data: parsed };
      } else {
        // Server proxy test
        const response = await fetch("/api/test-model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl,
            chatEndpoint,
            model: testModelId,
            apiKey,
            prompt,
          }),
        });

        if (response.status === 405 || response.status === 404) {
          throw new Error(
            `HTTP ${response.status} on /api/test-model. Please switch connection mode to 'Direct Browser Mode' for this static host.`
          );
        }

        try {
          data = await response.json();
        } catch (e) {
          throw new Error(`Failed to parse response (HTTP ${response.status})`);
        }

        if (!response.ok || !data?.ok) {
          const errorMsg = data?.data?.error?.message || data?.error || `API returned status ${response.status}`;
          throw new Error(errorMsg);
        }
      }

      setTestResponse(data);
    } catch (err: any) {
      setTestError(err.message || "An unexpected error occurred during model test.");
    } finally {
      setIsTesting(false);
    }
  };

  const filteredModels = useMemo(() => {
    if (!searchQuery) return models;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return models.filter((model) => typeof model.id === "string" && model.id.toLowerCase().includes(lowerQuery));
  }, [models, searchQuery]);

  const commonPrefixes = useMemo(() => {
    const prefixes = models
      .map((m) => (typeof m.id === "string" ? m.id.split(/[-:_/]/)[0] : ""))
      .filter(Boolean);

    const counts: Record<string, number> = {};
    for (const p of prefixes) {
      counts[p] = (counts[p] || 0) + 1;
    }

    return Object.entries(counts)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 8)
      .map((entry) => entry[0]);
  }, [models]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 selection:text-indigo-900 dark:selection:text-indigo-200 transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  AI Model Explorer
                </h1>
                <button
                  type="button"
                  onClick={() => setShowDeploymentHelp(!showDeploymentHelp)}
                  className="text-xs px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center transition-colors"
                  title="Cloudflare & Hosting Info"
                >
                  <Cloud className="w-3 h-3 mr-1" />
                  Cloudflare Ready
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspect, filter, and test OpenAI &amp; Anthropic compatible endpoints
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {/* Connection Mode Selector */}
            <div className="flex items-center bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                id="mode-auto-btn"
                onClick={() => handleModeChange("auto")}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                  mode === "auto"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                title="Automatic mode: uses server proxy with automatic direct browser fallback on static hosts"
              >
                Auto
              </button>
              <button
                type="button"
                id="mode-direct-btn"
                onClick={() => handleModeChange("direct")}
                className={`px-2.5 py-1.5 rounded-lg font-medium flex items-center space-x-1 transition-all ${
                  mode === "direct"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                title="Direct Browser Mode (works on Cloudflare Workers static sites, Pages, GitHub Pages, etc.)"
              >
                <Zap className="w-3 h-3 mr-1" />
                Direct
              </button>
              <button
                type="button"
                id="mode-server-btn"
                onClick={() => handleModeChange("server")}
                className={`px-2.5 py-1.5 rounded-lg font-medium flex items-center space-x-1 transition-all ${
                  mode === "server"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                title="Server Backend Proxy Mode (/api/*)"
              >
                <Server className="w-3 h-3 mr-1" />
                Proxy
              </button>
            </div>

            {/* Theme Toggle */}
            <div className="inline-flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <button
                id="theme-light-btn"
                type="button"
                onClick={() => setTheme("light")}
                className={`p-2 rounded-lg transition-colors ${
                  theme === "light"
                    ? "bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="Light Mode"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                id="theme-system-btn"
                type="button"
                onClick={() => setTheme("system")}
                className={`p-2 rounded-lg transition-colors ${
                  theme === "system"
                    ? "bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="System Theme"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                id="theme-dark-btn"
                type="button"
                onClick={() => setTheme("dark")}
                className={`p-2 rounded-lg transition-colors ${
                  theme === "dark"
                    ? "bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="Dark Mode"
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Cloudflare & Deployment Info Card */}
        {showDeploymentHelp && (
          <div className="bg-indigo-50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/50 rounded-3xl p-6 mb-8 text-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-900 dark:text-indigo-300 font-semibold">
                <Cloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Cloudflare Workers &amp; Static Hosting Compatibility</span>
              </div>
              <button
                onClick={() => setShowDeploymentHelp(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
              When hosting on <strong>Cloudflare Workers</strong> (e.g. <code>*.workers.dev</code>) or <strong>Cloudflare Pages</strong> as a static bundle, POST requests to <code>/api/*</code> return <code>405 (Method Not Allowed)</code> if edge functions are not configured.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-slate-700">
                <div className="font-semibold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center">
                  <Zap className="w-3.5 h-3.5 mr-1" /> Option 1: Direct Browser Mode
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Switch the mode toggle in the top-right to <strong>Direct</strong>. Calls are made straight from your browser to OpenAI, Groq, OpenRouter, Mistral, Ollama, etc. without needing any backend server!
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-slate-700">
                <div className="font-semibold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center">
                  <Server className="w-3.5 h-3.5 mr-1" /> Option 2: Cloudflare Functions / Worker
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  The codebase now includes <code>functions/api/fetch-models.ts</code> and <code>worker.ts</code> ready for Cloudflare Pages and Wrangler deployments!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Method Not Allowed / 405 Cloudflare Worker Alert */}
        {methodNotAllowedAlert && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Static Host / Cloudflare Worker (HTTP 405) Detected
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-1">
                  The host returned <code>405 Method Not Allowed</code> because the static file server does not handle backend POST endpoints. We can fetch models directly from your browser instead.
                </p>
              </div>
            </div>
            <button
              type="button"
              id="btn-switch-direct-retry"
              onClick={() => {
                handleModeChange("direct");
                fetchModels(undefined, "direct");
              }}
              className="inline-flex items-center justify-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Use Direct Browser Mode &amp; Retry
            </button>
          </div>
        )}

        {/* Quick Presets */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Quick Provider Presets:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_PRESETS.map((preset) => {
              const isSelected = baseUrl === preset.baseUrl && endpoint === preset.endpoint;
              return (
                <button
                  key={preset.name}
                  id={`preset-${preset.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-750"
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Configuration Form */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8 transition-all hover:shadow-md">
          <form onSubmit={(e) => fetchModels(e)} className="p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="baseUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    API Base URL &amp; Endpoint
                  </label>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono">
                    Mode: {mode === "direct" ? "⚡ Direct (Browser)" : mode === "server" ? "🌐 Server Proxy" : "🔄 Auto"}
                  </span>
                </div>
                <div className="flex rounded-xl shadow-sm">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Globe className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <input
                      type="text"
                      id="baseUrl"
                      className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-l-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 sm:text-sm"
                      placeholder="https://api.openai.com"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      required
                    />
                  </div>
                  <div className="relative w-[130px] sm:w-[150px]">
                    <input
                      type="text"
                      id="endpoint"
                      className="block w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border-y border-r border-l-0 border-slate-200 dark:border-slate-700 rounded-r-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 sm:text-sm font-mono text-xs"
                      placeholder="/v1/models"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  API Key <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional / Private)</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="password"
                    id="apiKey"
                    className="block w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 sm:text-sm font-mono"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            {mode === "cors-proxy" && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                <label htmlFor="customProxyUrl" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  CORS Proxy Prefix URL
                </label>
                <input
                  type="text"
                  id="customProxyUrl"
                  value={customProxyUrl}
                  onChange={(e) => setCustomProxyUrl(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                  placeholder="https://corsproxy.io/?"
                />
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {mode === "direct"
                  ? "⚡ Direct Mode: querying provider directly from your browser."
                  : "🔒 Request proxied safely to bypass CORS."}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  id="btn-check-models"
                  type="submit"
                  disabled={isLoading || !baseUrl.trim() || !endpoint.trim()}
                  className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-semibold rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Fetching Models...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="-ml-1 mr-2 h-4 w-4" />
                      Fetch Models
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 p-6 mb-8 border border-red-200 dark:border-red-900/50 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Connection or API Error</h3>
                <div className="mt-1 text-sm text-red-700 dark:text-red-400 break-words whitespace-pre-wrap font-mono text-xs">
                  {error}
                </div>
              </div>
            </div>
            {mode !== "direct" && (
              <button
                type="button"
                onClick={() => {
                  handleModeChange("direct");
                  fetchModels(undefined, "direct");
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-800 dark:text-red-300 text-xs font-semibold transition-colors shrink-0"
              >
                <Zap className="w-3.5 h-3.5 mr-1" />
                Retry in Direct Mode
              </button>
            )}
          </div>
        )}

        {/* Results Section */}
        {models.length > 0 && (
          <div className="flex flex-col space-y-6">
            {/* Search and Filters */}
            <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300">
                  <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800/50 mr-3 font-bold font-mono">
                    {filteredModels.length}
                  </span>
                  Models Available
                </div>
                <div className="relative max-w-md w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="text"
                    id="search-models-input"
                    className="block w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm"
                    placeholder="Search model IDs (e.g. gpt-4, claude, llama)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick Filter tags */}
              {commonPrefixes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                    Prefixes:
                  </span>
                  {commonPrefixes.map((prefix) => (
                    <button
                      key={prefix}
                      type="button"
                      onClick={() => setSearchQuery(prefix)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700/60 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-700 cursor-pointer"
                    >
                      {prefix}
                    </button>
                  ))}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="px-2.5 py-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Model Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredModels.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 border-dashed">
                  No models match "{searchQuery}".
                </div>
              ) : (
                filteredModels.map((model) => (
                  <ModelCard key={model.id} model={model} onTest={setTestModelId} />
                ))
              )}
            </div>
          </div>
        )}

        {/* Test Modal */}
        {testModelId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Model Prompt Test
                    </h3>
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-md">
                      {testModelId}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-close-test-modal"
                  onClick={() => setTestModelId(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label htmlFor="chatEndpointInput" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Completion / Messages Endpoint
                  </label>
                  <input
                    id="chatEndpointInput"
                    type="text"
                    value={chatEndpoint}
                    onChange={(e) => setChatEndpoint(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 sm:text-sm font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="promptInput" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Prompt
                  </label>
                  <textarea
                    id="promptInput"
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 sm:text-sm resize-none font-sans"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    id="btn-send-test-request"
                    type="button"
                    onClick={runTest}
                    disabled={isTesting || !prompt.trim()}
                    className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-semibold rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Response...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2 fill-current" />
                        Send Test Request
                      </>
                    )}
                  </button>
                </div>

                {testError && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-400 font-mono break-all">
                    {testError}
                  </div>
                )}

                {testResponse && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Model Output
                    </h4>

                    {testResponse.data?.choices?.[0]?.message?.content ? (
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans text-sm">
                        {testResponse.data.choices[0].message.content}
                      </div>
                    ) : testResponse.data?.content?.[0]?.text ? (
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans text-sm">
                        {testResponse.data.content[0].text}
                      </div>
                    ) : null}

                    <details className="group pt-2">
                      <summary className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer select-none">
                        View Raw JSON Response
                      </summary>
                      <pre className="mt-2 p-4 bg-slate-950 text-slate-300 rounded-xl text-xs overflow-x-auto border border-slate-800 max-h-60">
                        {JSON.stringify(testResponse, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
