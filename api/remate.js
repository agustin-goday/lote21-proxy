// api/remate.js — Vercel Serverless Function
// Lee lote21.uy/vivo/ y devuelve los datos del próximo remate en JSON

export default async function handler(req, res) {
  // Permitir CORS para que agrodemaria.com.uy pueda llamar a esta API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate"); // Cache 1 hora

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const response = await fetch("https://www.lote21.uy/vivo/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-UY,es;q=0.9",
      },
    });

    const html = await response.text();

    // Extraer número de remate (ej: "Remate 248")
    const reemateNumMatch = html.match(/Remate\s+(\d+)/i);
    const numero = reemateNumMatch ? reemateNumMatch[1] : null;

    // Extraer días (ej: "DIA 1: jueves, 21 de mayo - 09:00")
    const diasMatches = [
      ...html.matchAll(/DIA\s+(\d+):\s*([^<\n\r]+)/gi),
    ];
    const dias = diasMatches.map((m) => ({
      dia: m[1],
      descripcion: m[2].trim(),
    }));

    // Extraer "PRÓXIMO REMATE" si existe
    const proximoMatch = html.match(/PRÓXIMO REMATE\s+([^<\n\r]+)/i);
    const proximoRemate = proximoMatch ? proximoMatch[1].trim() : null;

    if (!numero && dias.length === 0) {
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
      proximoRemate: proximoRemate || (dias[0] ? dias[0].descripcion : null),
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
