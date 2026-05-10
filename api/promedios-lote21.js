// api/promedios-lote21.js — Lee promedios de un remate de Lote21

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  const remate = req.query.r;
  if (!remate) return res.status(400).json({ ok: false, error: "Falta parámetro r" });

  // Probar con año actual y año anterior (la URL cambia cada año)
  const anioActual = new Date().getFullYear();
  const urls = [
    `https://panel.lote21.uy/${anioActual}/json/web/lotes_promedios_get.asp?r=${remate}`,
    `https://panel.lote21.uy/${anioActual - 1}/json/web/lotes_promedios_get.asp?r=${remate}`,
    `https://panel.lote21.uy/${anioActual + 1}/json/web/lotes_promedios_get.asp?r=${remate}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
          "Referer": "https://www.lote21.uy/promedios/",
        }
      });

      if (!response.ok) continue;
      const text = await response.text();
      if (!text || text.includes("404") || text.includes("Error")) continue;

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        continue;
      }

      return res.status(200).json({ ok: true, remate, data, urlUsada: url });

    } catch { continue; }
  }

  return res.status(404).json({ ok: false, error: "No se encontraron promedios para el remate " + remate });
}
