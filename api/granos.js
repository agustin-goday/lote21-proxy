// api/granos.js — DEBUG internacional
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const r = await fetch("https://verdenews.com.uy/mercado-de-granos/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-UY,es;q=0.9",
      }
    });
    const html = await r.text();
    const texto = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

    const idxIntl = texto.indexOf("Mercado Internacional");
    const idxNac  = texto.indexOf("Mercado Nacional");

    return res.status(200).json({
      ok: true,
      idxIntl,
      idxNac,
      bloqIntl: idxIntl > -1 ? texto.substring(idxIntl, idxIntl + 400) : "NO ENCONTRADO",
    });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
