// api/remate.js — Vercel Serverless Function
// Soporta fechas en mayúsculas y minúsculas (ej: "MARTES, 9 DE JUNIO" o "martes, 21 de mayo")

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");

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
    const numeroMatch = html.match(/Remate\s+n?°?\s*(\d+)/i);
    const numero = numeroMatch ? numeroMatch[1] : null;

    // Limpiar HTML: quitar tags, normalizar espacios y &nbsp;
    const textoLimpio = html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\u00a0/g, " ")         // non-breaking space unicode
      .replace(/\s+/g, " ")
      .trim();

    // Regex flexible: captura "DIA 1: MARTES, 9 DE JUNIO - 09:00" o "DIA 1: jueves, 21 de mayo - 09:00"
    // Acepta letras con tildes, coma, números, espacios, guión y dos puntos en la hora
    const diasMatches = [
      ...textoLimpio.matchAll(
        /DIA\s+(\d+)\s*:\s*([\wáéíóúüñÁÉÍÓÚÜÑ]+,\s*\d+\s+(?:DE\s+)?[\wáéíóúüñÁÉÍÓÚÜÑ]+\s*[-–]\s*\d{1,2}:\d{2})/gi
      ),
    ];

    const dias = diasMatches.map((m) => ({
      dia: m[1].trim(),
      descripcion: m[2].trim(),
    }));

    // Fallback: PRÓXIMO REMATE (para cuando hay un solo día sin formato DIA N:)
    const proximoMatch = textoLimpio.match(
      /PRÓXIMO REMATE\s+([\wáéíóúüñÁÉÍÓÚÜÑ,\s]+\d+:\d{2})/i
    );
    const proximoRemate =
      proximoMatch
        ? proximoMatch[1].trim()
        : dias.length > 0
        ? dias[0].descripcion
        : null;

    if (!numero && dias.length === 0 && !proximoRemate) {
      return res.status(200).json({
        ok: false,
        error: "No se encontraron datos del remate",
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      ok: true,
      numero,
      dias,
      proximoRemate,
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
