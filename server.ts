import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

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

function formatFetchError(error: any, urlString: string): { status: number; message: string } {
  let hostname = "";
  try {
    hostname = new URL(normalizeUrl(urlString)).hostname;
  } catch (e) {
    hostname = urlString;
  }

  if (error.name === "AbortError") {
    return {
      status: 504,
      message: `Request timed out connecting to ${hostname || "endpoint"}. The server took too long to respond (> 15s).`,
    };
  }

  const cause = error.cause;
  const causeCode = cause?.code || error.code || "";
  const causeMsg = cause?.message || error.message || "";

  if (causeCode === "ENOTFOUND" || causeMsg.includes("ENOTFOUND") || causeMsg.includes("getaddrinfo")) {
    return {
      status: 502,
      message: `Could not resolve domain "${hostname}" (DNS ENOTFOUND). Please verify the domain spelling and ensure it is accessible on the public Internet.`,
    };
  }

  if (causeCode === "ECONNREFUSED" || causeMsg.includes("ECONNREFUSED")) {
    return {
      status: 502,
      message: `Connection refused at ${hostname}. The service is not running or not listening on this port.`,
    };
  }

  if (causeCode === "ETIMEDOUT" || causeMsg.includes("ETIMEDOUT")) {
    return {
      status: 504,
      message: `Connection timed out connecting to ${hostname}.`,
    };
  }

  if (causeCode === "ECONNRESET" || causeMsg.includes("ECONNRESET")) {
    return {
      status: 502,
      message: `Connection was reset by ${hostname}.`,
    };
  }

  if (causeMsg.includes("unable to verify") || causeMsg.includes("CERT_") || causeCode.includes("CERT_")) {
    return {
      status: 502,
      message: `SSL/TLS certificate error connecting to ${hostname}: ${causeMsg}`,
    };
  }

  return {
    status: 500,
    message: `Connection failed to ${hostname || "server"}: ${causeMsg || error.message || "Unknown network error"}`,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON payload received" });
    }
    next();
  });

  app.post("/api/fetch-models", async (req, res) => {
    const { url, apiKey } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "API URL is required" });
    }

    const normalizedUrl = normalizeUrl(url);

    try {
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

      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
        return res.status(413).json({ error: "API returned a response that is too large (> 10MB)." });
      }

      const text = await response.text();

      if (!response.ok) {
        let errorMessage = text;
        if (text.trim().startsWith("<")) {
          errorMessage = `Received HTML status ${response.status} from endpoint. Make sure the URL points to a JSON API endpoint (e.g. https://api.openai.com/v1/models).`;
        } else if (text.length > 300) {
          errorMessage = text.substring(0, 300) + "...";
        }
        return res.status(response.status).json({ 
          error: `API Error (HTTP ${response.status}): ${errorMessage}` 
        });
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e: any) {
        return res.status(500).json({
          error: "The endpoint returned invalid JSON. It might be returning an HTML page instead of an API response."
        });
      }

      res.json(data);
    } catch (error: any) {
      const { status, message } = formatFetchError(error, normalizedUrl);
      console.warn(`[Proxy Warning] /api/fetch-models: ${message}`);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/test-model", async (req, res) => {
    const { baseUrl, chatEndpoint, model, apiKey, prompt } = req.body;
    if (!baseUrl || !chatEndpoint || !model || !prompt) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const cleanBase = normalizeUrl(baseUrl).replace(/\/$/, "");
    const cleanEndpoint = chatEndpoint.trim().startsWith("/") ? chatEndpoint.trim() : "/" + chatEndpoint.trim();
    const url = `${cleanBase}${cleanEndpoint}`;

    try {
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
        // Anthropic messages format
        headers["anthropic-version"] = "2023-06-01";
        payload = {
          model: model,
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }]
        };
      } else {
        // Standard OpenAI chat completions format
        payload = {
          model: model,
          messages: [{ role: "user", content: prompt }]
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

      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
        return res.status(413).json({ error: "API returned a response that is too large (> 10MB)." });
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e: any) {
        return res.status(500).json({
          error: `The endpoint returned invalid JSON. Status: ${response.status}. Preview: ${text.substring(0, 200)}`
        });
      }
      
      res.json({ ok: response.ok, status: response.status, data });
    } catch (error: any) {
      const { status, message } = formatFetchError(error, url);
      console.warn(`[Proxy Warning] /api/test-model: ${message}`);
      res.status(status).json({ 
        error: `Test failed: ${message}` 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
