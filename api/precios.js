// api/precios.js — con Upstash para guardar semana anterior

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  function extraer(texto, patron) {
    const m = texto.match(patron);
    return m ? m[1].replace(",", ".") : null;
  }

  // Upstash Redis REST API
  const KV_URL   = process.env.KV_REST_API_URL   || process.env.STORAGE_KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN  || process.env.STORAGE_KV_REST_API_TOKEN;

  async function kvGet(key) {
    if (!KV_URL || !KV_TOKEN) return null;
    try {
      const r = await fetch(`${KV_URL}/get/${key}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const d = await r.json();
      return d.result ? JSON.parse(d.result) : null;
    } catch { return null; }
  }

  async function kvSet(key, value) {
    if (!KV_URL || !KV_TOKEN) return;
    try {
      await fetch(`${KV_URL}/set/${key}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(JSON.stringify(value))
      });
    } catch {}
  }

  try {
    // ── Scrape ACG home ──
    const homeRes = await fetch("https://acg.com.uy/", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", Accept: "text/html" },
    });
    const homeHtml = await homeRes.text();
    const t = homeHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    const semana     = t.match(/semana\s+N[°º]\s*(\d+)/i)?.[1] || null;
    const novillo    = extraer(t, /Novillo[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaca       = extraer(t, /Vaca[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaquillona = extraer(t, /Vaquillona[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const ternero       = extraer(t, /Ternero[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const ternera       = extraer(t, /Ternera[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const vacaInvernada = extraer(t, /Vaca de Invernada[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const bovinos    = extraer(t, /Faena semanal\s*([\d.,]+)\s*vacunos/i);
    const bovinosAnt = extraer(t, /vacunos\s*([\d.,]+)\s*semana anterior/i);
    const ovinos     = extraer(t, /Faena semanal[\s\S]{0,300}?([\d.,]+)\s*ovinos/i);
    const ovinosAnt  = extraer(t, /ovinos\s*([\d.,]+)\s*semana anterior/i);

    // ── Leer semana anterior guardada ──
    const guardado = await kvGet("acg_precios_anteriores");
    let novilloAnt    = guardado?.novillo    || null;
    let vacaAnt       = guardado?.vaca       || null;
    let vaquillonaAnt = guardado?.vaquillona || null;
    const semanaGuardada = guardado?.semana  || null;

    // ── Guardar actuales si cambió la semana ──
    if (semana && semana !== semanaGuardada && novillo && vaca && vaquillona) {
      await kvSet("acg_precios_anteriores", {
        semana,
        novillo,
        vaca,
        vaquillona,
        guardadoEn: new Date().toISOString()
      });
    }

    return res.status(200).json({
      ok: true,
      semana,
      gordos: { novillo, novilloAnt, vaca, vacaAnt, vaquillona, vaquillonaAnt },
      reposicion: { ternero, ternera, vacaInvernada },
      faena: {
        bovinos:    bovinos?.replace(/\./g,"")    || null,
        bovinosAnt: bovinosAnt?.replace(/\./g,"") || null,
        ovinos:     ovinos?.replace(/\./g,"")     || null,
        ovinosAnt:  ovinosAnt?.replace(/\./g,"")  || null,
      },
      semanaAnteriorGuardada: semanaGuardada,
      kvConectado: !!(KV_URL && KV_TOKEN),
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
