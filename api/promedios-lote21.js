// api/promedios-lote21.js — Lee promedios de un remate de Lote21

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  const remate = req.query.r;
  if (!remate) return res.status(400).json({ ok: false, error: "Falta parámetro r" });

  try {
    const response = await fetch(`https://www.lote21.uy/lotes_promedios_get.asp?r=${remate}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
        "Referer": "https://www.lote21.uy/promedios/",
      }
    });

    const text = await response.text();

    // Intentar parsear como JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Si no es JSON, devolver el texto crudo para debug
      return res.status(200).json({ ok: true, remate, raw: text.substring(0, 2000) });
    }

    return res.status(200).json({ ok: true, remate, data });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
