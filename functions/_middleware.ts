export async function onRequest(context: { request: Request; next: () => Promise<Response> }) {
  const url = new URL(context.request.url);

  // Auto-redirect HTTP to HTTPS (excluding local development)
  if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
