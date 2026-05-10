
// api/debug-kv.js — ver exactamente qué hay en Upstash

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const KV_URL   = process.env.STORAGE_KV_REST_API_URL
                || process.env.KV_REST_API_URL
                || process.env.UPSTASH_REDIS_REST_URL;

  const KV_TOKEN = process.env.STORAGE_KV_REST_API_TOKEN
                || process.env.KV_REST_API_TOKEN
                || process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    // Leer crudo sin parsear
    const r = await fetch(`${KV_URL}/get/acg_precios_anteriores`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const raw = await r.text();

    // Intentar parsear
    let parsed = null;
    let parsed2 = null;
    try {
      parsed = JSON.parse(raw);
      if (parsed?.result) {
        parsed2 = JSON.parse(parsed.result);
      }
    } catch(e) {}

    return res.status(200).json({
      ok: true,
      rawResponse: raw.substring(0, 500),
      parsed,
      parsed2,
    });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
