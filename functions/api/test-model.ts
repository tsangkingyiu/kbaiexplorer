// Cloudflare Pages / Workers Function for /api/test-model
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
    const { baseUrl, chatEndpoint, model, apiKey, prompt } = body || {};

    if (!baseUrl || !chatEndpoint || !model || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanBase = String(baseUrl).trim().replace(/\/$/, "");
    const cleanEndpoint = String(chatEndpoint).trim().startsWith("/") ? String(chatEndpoint).trim() : `/${String(chatEndpoint).trim()}`;
    const url = `${cleanBase}${cleanEndpoint}`;

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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: response.ok, status: response.status, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      return new Response(JSON.stringify({ error: "Request timed out after 20 seconds." }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: `Worker test failed: ${error.message || "Failed to test model"}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
