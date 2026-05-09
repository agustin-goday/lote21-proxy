// api/remate.js — Vercel Serverless Function
// Lee lote21.uy/vivo/ y devuelve los datos del próximo remate en JSON

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch("https://www.lote21.uy/vivo/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-UY,es;q=0.9",
      },
    });

    const html = await response.text();

    // Extraer número de remate
    const numeroMatch = html.match(/Remate\s+(\d+)/i);
    const numero = numeroMatch ? numeroMatch[1] : null;

    // Limpiar HTML para facilitar extracción: quitar tags, normalizar espacios
    const textoLimpio = html
      .replace(/<[^>]+>/g, " ")   // quitar todos los tags HTML
      .replace(/&nbsp;/g, " ")     // quitar &nbsp;
      .replace(/\s+/g, " ");       // normalizar espacios múltiples

    // Extraer días con regex más amplio sobre texto limpio
    // Captura: "DIA 1: jueves, 21 de mayo - 09:00"
    const diasMatches = [...textoLimpio.matchAll(/DIA\s+(\d+)\s*:\s*([\w,\sáéíóúüñÁÉÍÓÚÜÑde]+\d+\s*[-–]\s*\d+:\d+)/gi)];
    const dias = diasMatches.map((m) => ({
      dia: m[1].trim(),
      descripcion: m[2].trim(),
    }));

    // Extraer "PRÓXIMO REMATE" del texto limpio
    const proximoMatch = textoLimpio.match(/PRÓXIMO REMATE\s+([\w,\sáéíóúüñÁÉÍÓÚÜÑde]+\d+\s*[-–]\s*\d+:\d+)/i);
    const proximoRemate = proximoMatch ? proximoMatch[1].trim() : null;

    // Si no capturamos días con el regex, intentar extraer desde proximoRemate
    const diasFinal = dias.length > 0 ? dias : (proximoRemate ? [{ dia: "1", descripcion: proximoRemate }] : []);

    if (!numero && diasFinal.length === 0) {
      return res.status(200).json({
        ok: false,
        error: "No se encontraron datos del remate",
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      ok: true,
      numero,
      dias: diasFinal,
      proximoRemate: proximoRemate || (diasFinal[0] ? diasFinal[0].descripcion : null),
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}
