/**
 * Cloudflare Worker Entry Point
 * Handles API routes (/api/fetch-models, /api/test-model) and serves static assets.
 */

function normalizeUrl(inputUrl: string): string {
  let url = inputUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith("localhost") || url.startsWith("127.0.0.1") || url.startsWith("0.0.0.0")) {
      url = `http://${url}`;
    } else {
      url = `https://${url}`;
    }
  }
  return url;
}

interface Env {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, api-key, anthropic-version, *",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    // Handle CORS preflight for all endpoints
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Handle /api/fetch-models (POST or GET)
    if (pathname === "/api/fetch-models" || pathname.endsWith("/api/fetch-models")) {
      try {
        let rawUrl = "";
        let apiKey = "";

        if (request.method === "POST") {
          try {
            const body: any = await request.json();
            rawUrl = body?.url || "";
            apiKey = body?.apiKey || "";
          } catch (e) {
            // body parse fallback
          }
        }

        if (!rawUrl) {
          rawUrl = url.searchParams.get("url") || "";
        }
        if (!apiKey) {
          apiKey = url.searchParams.get("apiKey") || request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
        }

        if (!rawUrl || typeof rawUrl !== "string") {
          return new Response(JSON.stringify({ error: "Target API URL is required (url parameter)" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const targetUrl = normalizeUrl(rawUrl);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
          const key = apiKey.trim();
          headers["Authorization"] = `Bearer ${key}`;
          headers["x-api-key"] = key;
          headers["api-key"] = key;
        }

        if (targetUrl.includes("anthropic.com") || targetUrl.includes("/v1/models")) {
          headers["anthropic-version"] = "2023-06-01";
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(targetUrl.trim(), {
          method: "GET",
          headers,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const text = await response.text();

        if (!response.ok) {
          let errorMessage = text;
          if (text.trim().startsWith("<")) {
            errorMessage = `Endpoint returned status ${response.status} with HTML instead of JSON. Ensure the domain and path are correct.`;
          } else if (text.length > 300) {
            errorMessage = text.substring(0, 300) + "...";
          }
          return new Response(JSON.stringify({ error: `API Error (${response.status}): ${errorMessage}` }), {
            status: response.status,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (e: any) {
          return new Response(JSON.stringify({ error: "The remote endpoint returned invalid JSON." }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          return new Response(JSON.stringify({ error: "Request timed out after 20 seconds." }), {
            status: 504,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `Connection failed: ${err.message || "Failed to reach endpoint."}` }), {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // Handle /api/test-model (POST or GET)
    if (pathname === "/api/test-model" || pathname.endsWith("/api/test-model")) {
      try {
        let body: any = {};
        if (request.method === "POST") {
          try {
            body = await request.json();
          } catch (e) {
            // fallback
          }
        }

        const baseUrl = body.baseUrl || url.searchParams.get("baseUrl");
        const chatEndpoint = body.chatEndpoint || url.searchParams.get("chatEndpoint") || "/v1/chat/completions";
        const model = body.model || url.searchParams.get("model");
        const apiKey = body.apiKey || url.searchParams.get("apiKey") || "";
        const prompt = body.prompt || url.searchParams.get("prompt");

        if (!baseUrl || !chatEndpoint || !model || !prompt) {
          return new Response(JSON.stringify({ error: "Missing required fields (baseUrl, chatEndpoint, model, prompt)" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const cleanBase = normalizeUrl(String(baseUrl)).replace(/\/$/, "");
        const cleanEndpoint = String(chatEndpoint).trim().startsWith("/") ? String(chatEndpoint).trim() : `/${String(chatEndpoint).trim()}`;
        const targetUrl = `${cleanBase}${cleanEndpoint}`;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
          const key = apiKey.trim();
          headers["Authorization"] = `Bearer ${key}`;
          headers["x-api-key"] = key;
          headers["api-key"] = key;
        }

        let payload: any;
        if (chatEndpoint.includes("messages")) {
          headers["anthropic-version"] = "2023-06-01";
          payload = {
            model,
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          };
        } else {
          payload = {
            model,
            messages: [{ role: "user", content: prompt }],
          };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e: any) {
          return new Response(
            JSON.stringify({
              error: `The endpoint returned non-JSON response. Status: ${response.status}. Preview: ${text.substring(0, 200)}`,
            }),
            {
              status: 500,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(JSON.stringify({ ok: response.ok, status: response.status, data }), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          return new Response(JSON.stringify({ error: "Request timed out after 60 seconds." }), {
            status: 504,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `Test connection error: ${err.message || "Failed to test model"}` }), {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // Static asset serving if worker is bound to ASSETS
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
