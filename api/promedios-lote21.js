// api/promedios-lote21.js — Lee promedios de un remate de Lote21

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  const remate = req.query.r;
  if (!remate) return res.status(400).json({ ok: false, error: "Falta parámetro r" });

  // Probar con varios años posibles
  const anos = [2026, 2025, 2024, 2023];
  const debug = [];

  for (const ano of anos) {
    const url = `https://panel.lote21.uy/${ano}/json/web/lotes_promedios_get.asp?r=${remate}`;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
          "Referer": "https://www.lote21.uy/promedios/",
          "Accept": "application/json, text/plain, */*",
        }
      });

      const text = await response.text();
      debug.push({ ano, status: response.status, preview: text.substring(0, 100) });

      if (!response.ok) continue;
      if (!text || text.includes("<!DOCTYPE") || text.trim() === "") continue;

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        continue;
      }

      return res.status(200).json({ ok: true, remate, ano, data });

    } catch(e) {
      debug.push({ ano, error: e.message });
    }
  }

  return res.status(404).json({ ok: false, error: "No se encontraron promedios", debug });
}
