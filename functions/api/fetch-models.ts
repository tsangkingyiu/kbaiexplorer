// Cloudflare Pages / Workers Function for /api/fetch-models

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

async function handleFetchModels(request: Request) {
  try {
    const reqUrl = new URL(request.url);
    let targetUrlParam = "";
    let apiKey = "";

    if (request.method === "POST") {
      try {
        const body: any = await request.json();
        targetUrlParam = body?.url || "";
        apiKey = body?.apiKey || "";
      } catch (e) {
        // fallback to query params
      }
    }

    if (!targetUrlParam) {
      targetUrlParam = reqUrl.searchParams.get("url") || "";
    }
    if (!apiKey) {
      apiKey = reqUrl.searchParams.get("apiKey") || request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    }

    if (!targetUrlParam || typeof targetUrlParam !== "string") {
      return new Response(JSON.stringify({ error: "API URL is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const normalizedUrl = normalizeUrl(targetUrlParam);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    const isAnthropic = normalizedUrl.toLowerCase().includes("anthropic.com");
    if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
      const key = apiKey.trim();
      headers["Authorization"] = `Bearer ${key}`;
      if (isAnthropic) {
        headers["x-api-key"] = key;
      }
    }

    if (isAnthropic) {
      headers["anthropic-version"] = "2023-06-01";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(normalizedUrl, {
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
  } catch (error: any) {
    if (error.name === "AbortError") {
      return new Response(JSON.stringify({ error: "Request timed out after 20 seconds." }), {
        status: 504,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: `Connection failed: ${error.message || "Failed to reach endpoint."}` }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}

export async function onRequestPost(context: { request: Request }) {
  return handleFetchModels(context.request);
}

export async function onRequestGet(context: { request: Request }) {
  return handleFetchModels(context.request);
}

export async function onRequest(context: { request: Request }) {
  if (context.request.method === "OPTIONS") {
    return onRequestOptions();
  }
  return handleFetchModels(context.request);
}
