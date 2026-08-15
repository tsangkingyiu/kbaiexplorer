import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

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

      if (url.includes("anthropic.com") || url.includes("/v1/models")) {
        headers["anthropic-version"] = "2023-06-01";
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url.trim(), {
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
      console.error("Fetch models error:", error);
      if (error.name === "AbortError") {
        return res.status(504).json({ error: "Request timed out after 15 seconds. Please check the URL or your network." });
      }
      const msg = error.cause?.message || error.message || "Failed to fetch models. Check the URL and try again.";
      res.status(500).json({ 
        error: `Connection error: ${msg}` 
      });
    }
  });

  app.post("/api/test-model", async (req, res) => {
    const { baseUrl, chatEndpoint, model, apiKey, prompt } = req.body;
    if (!baseUrl || !chatEndpoint || !model || !prompt) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const url = `${baseUrl.trim().replace(/\/$/, "")}${chatEndpoint.trim().startsWith("/") ? chatEndpoint.trim() : "/" + chatEndpoint.trim()}`;
      
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
      console.error("Test model error:", error);
      if (error.name === "AbortError") {
        return res.status(504).json({ error: "Request timed out after 20 seconds." });
      }
      const msg = error.cause?.message || error.message || "Failed to test model. Check the URL and try again.";
      res.status(500).json({ 
        error: `Test failed: ${msg}` 
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
