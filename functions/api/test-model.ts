// Cloudflare Pages / Workers Function for /api/test-model

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, api-key, anthropic-version, *",
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

async function handleTestModel(request: Request) {
  try {
    const reqUrl = new URL(request.url);
    let body: any = {};
    if (request.method === "POST") {
      try {
        body = await request.json();
      } catch (e) {
        // fallback
      }
    }

    const baseUrl = body.baseUrl || reqUrl.searchParams.get("baseUrl");
    const chatEndpoint = body.chatEndpoint || reqUrl.searchParams.get("chatEndpoint") || "/v1/chat/completions";
    const model = body.model || reqUrl.searchParams.get("model");
    const apiKey = body.apiKey || reqUrl.searchParams.get("apiKey") || "";
    const prompt = body.prompt || reqUrl.searchParams.get("prompt");

    if (!baseUrl || !chatEndpoint || !model || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const cleanBase = normalizeUrl(String(baseUrl)).replace(/\/$/, "");
    const cleanEndpoint = String(chatEndpoint).trim().startsWith("/") ? String(chatEndpoint).trim() : `/${String(chatEndpoint).trim()}`;
    const url = `${cleanBase}${cleanEndpoint}`;

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
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(url, {
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
  } catch (error: any) {
    if (error.name === "AbortError") {
      return new Response(JSON.stringify({ error: "Request timed out after 25 seconds." }), {
        status: 504,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: `Connection failed: ${error.message || "Failed to test model"}` }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}

export async function onRequestPost(context: { request: Request }) {
  return handleTestModel(context.request);
}

export async function onRequestGet(context: { request: Request }) {
  return handleTestModel(context.request);
}

export async function onRequest(context: { request: Request }) {
  if (context.request.method === "OPTIONS") {
    return onRequestOptions();
  }
  return handleTestModel(context.request);
}
