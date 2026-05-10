// api/plazarural.js — Scraper del próximo remate de Plaza Rural

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // 1. Leer /remates y tomar el primer número de remate activo
    const listRes = await fetch("https://plazarural.com.uy/remates", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    const listHtml = await listRes.text();

    // Extraer primer número de remate de los links /remates/NNN
    const numeroMatch = listHtml.match(/\/remates\/(\d+)/);
    const numero = numeroMatch ? numeroMatch[1] : null;
    if (!numero) throw new Error("No se encontró número de remate");

    // 2. Leer la página del remate para obtener fecha completa
    const remateRes = await fetch(`https://plazarural.com.uy/remates/${numero}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    const remateHtml = await remateRes.text();
    const remateTexto = remateHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Formato: "Jueves 10 · Viernes 11 · Diciembre 2026"
    const fechaMatch = remateTexto.match(
      /((?:Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)\s+\d+\s*[·\-]\s*(?:.*?)\d{4})/i
    );
    const fechaCompleta = fechaMatch ? fechaMatch[1].replace(/\s+/g, " ").trim() : null;

    // Lugar del remate
    const lugarMatch = remateTexto.match(/Hotel[^.]{0,60}|Complejo[^.]{0,60}|Auditorio[^.]{0,60}|Sal[oó]n[^.]{0,60}/i);
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
