// api/cargar-semana-anterior.js — BORRAR después de usar

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const KV_URL   = process.env.STORAGE_KV_REST_API_URL
                || process.env.KV_REST_API_URL
                || process.env.UPSTASH_REDIS_REST_URL;
  const KV_TOKEN = process.env.STORAGE_KV_REST_API_TOKEN
                || process.env.KV_REST_API_TOKEN
                || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ ok: false, error: "KV no configurado" });
  }

  const datos = {
    semana:     "17",
    novillo:    "5.41",
    vaca:       "5.07",
    vaquillona: "5.30",
    guardadoEn: new Date().toISOString()
  };

  try {
    // Un solo JSON.stringify esta vez
    const r = await fetch(`${KV_URL}/set/acg_precios_anteriores`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datos)
    });
    const result = await r.json();
    return res.status(200).json({ ok: true, guardado: datos, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
