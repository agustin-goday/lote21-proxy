// api/plazarural.js — Scraper del próximo remate de Plaza Rural

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch("https://plazarural.com.uy/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-UY,es;q=0.9",
      },
    });

    const html = await response.text();
    const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Extraer número de remate y días desde el home
    // Formato: "Ver Remate 322 Jue. 14 · Vie. 15 · May."
    const remateMatch = texto.match(/Ver Remate\s+(\d+)\s+([\w\s\d·.,]+?)(?=\s{2,}|$)/i);
    const numero = remateMatch ? remateMatch[1] : null;

    if (!numero) throw new Error("No se encontró número de remate");

    // Buscar página del remate para obtener fecha completa
    const remateRes = await fetch(`https://plazarural.com.uy/remates/${numero}`, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
    });
    const remateHtml = await remateRes.text();
    const remateTexto = remateHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Formato: "Jueves 14 · Viernes 15 · Mayo 2026"
    const fechaMatch = remateTexto.match(/((?:Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)\s+\d+\s*[·\-]\s*[\s\S]{0,80}?\d{4})/i);
    const fechaCompleta = fechaMatch ? fechaMatch[1].replace(/\s+/g, " ").trim() : null;

    // Lugar del remate
    const lugarMatch = remateTexto.match(/Hotel[^.]{0,60}|Complejo[^.]{0,60}|Auditorio[^.]{0,60}|Salón[^.]{0,60}/i);
    const lugar = lugarMatch ? lugarMatch[0].trim() : null;

    return res.status(200).json({
      ok: true,
      numero,
      fechaCompleta,
      lugar,
      url: `https://plazarural.com.uy/remates/${numero}`,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
