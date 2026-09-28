import { procesarWebhook } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const reto = url.searchParams.get("hub.challenge");
  const esperado = process.env.WA_VERIFY_TOKEN?.trim();
  if (modo === "subscribe" && esperado && token === esperado && reto) {
    return new Response(reto, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const cuerpo: unknown = await request.json();
    await procesarWebhook(cuerpo);
  } catch {
    // Meta reintenta si no respondemos 200. El pedido no depende de este webhook.
  }
  return Response.json({ ok: true });
}
