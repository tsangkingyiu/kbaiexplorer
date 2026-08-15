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

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, api-key, anthropic-version",
    },
  });
}

export async function onRequestPost(context: { request: Request }) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, api-key, anthropic-version",
  };

  try {
    const body: any = await context.request.json();
    const { url, apiKey } = body || {};

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "API URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedUrl = normalizeUrl(url);

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

    if (normalizedUrl.includes("anthropic.com") || normalizedUrl.includes("/v1/models")) {
      headers["anthropic-version"] = "2023-06-01";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e: any) {
      return new Response(JSON.stringify({ error: "The endpoint returned invalid JSON." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      return new Response(JSON.stringify({ error: "Request timed out after 15 seconds." }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: `Connection failed: ${error.message || "Failed to reach endpoint. Please check the URL or try Direct Browser Mode."}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
