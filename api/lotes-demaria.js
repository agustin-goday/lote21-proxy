// api/lotes-demaria.js
// Devuelve los lotes de De María Agronegocios para un remate de Lote21

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  const remate = req.query.r;
  if (!remate) return res.status(400).json({ ok: false, error: "Falta parámetro r" });

  const ESCRITORIO = "10016"; // De María Agronegocios
  const anos = [2026, 2025, 2024];

  for (const ano of anos) {
    try {
      const url = `https://panel.lote21.uy/${ano}/json/web/lotes_relacionados.asp?e=${ESCRITORIO}&n=1234567&r=${remate}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
          "Referer": `https://lote21.uy/escritorio/?n=${ESCRITORIO}`,
          "Accept": "application/json, text/plain, */*",
        }
      });
      if (!response.ok) continue;
      const text = await response.text();
      if (!text || text.trim() === "" || text.includes("<!DOCTYPE")) continue;
      let lotes;
      try { lotes = JSON.parse(text); } catch { continue; }
      return res.status(200).json({ ok: true, remate, ano, total: lotes.length, lotes });
    } catch(e) { continue; }
  }

  return res.status(404).json({ ok: false, error: "No se encontraron lotes para el remate " + remate });
}
