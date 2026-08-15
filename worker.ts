/**
 * Cloudflare Worker Entry Point
 * Handles API routes (/api/fetch-models, /api/test-model) and serves static assets if available.
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, api-key, anthropic-version",
};

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Handle /api/fetch-models
    if (url.pathname === "/api/fetch-models" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const { url: rawUrl, apiKey } = body || {};

        if (!rawUrl || typeof rawUrl !== "string") {
          return new Response(JSON.stringify({ error: "API URL is required" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const targetUrl = normalizeUrl(rawUrl);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(targetUrl.trim(), {
          method: "GET",
          headers,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const text = await response.text();

        if (!response.ok) {
          let errorMessage = text;
          if (text.trim().startsWith("<")) {
            errorMessage = `Received HTML status ${response.status} from endpoint. Make sure the URL points to a JSON API endpoint.`;
          } else if (text.length > 300) {
            errorMessage = text.substring(0, 300) + "...";
          }
          return new Response(JSON.stringify({ error: `API Error (HTTP ${response.status}): ${errorMessage}` }), {
            status: response.status,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (e: any) {
          return new Response(JSON.stringify({ error: "The endpoint returned invalid JSON." }), {
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
          return new Response(JSON.stringify({ error: "Request timed out after 15 seconds." }), {
            status: 504,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `Connection error: ${err.message || "Failed to fetch models"}` }), {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // Handle /api/test-model
    if (url.pathname === "/api/test-model" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const { baseUrl, chatEndpoint, model, apiKey, prompt } = body || {};

        if (!baseUrl || !chatEndpoint || !model || !prompt) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
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
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
        const timeoutId = setTimeout(() => controller.abort(), 20000);

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
              error: `The endpoint returned invalid JSON. Status: ${response.status}. Preview: ${text.substring(0, 200)}`,
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
          return new Response(JSON.stringify({ error: "Request timed out after 20 seconds." }), {
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
