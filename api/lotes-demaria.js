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
  const N_TOKEN    = "1234567";

  try {
    const url = `https://lote21.uy/lotes_relacionados.asp?e=${ESCRITORIO}&n=${N_TOKEN}&r=${remate}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
        "Referer": `https://lote21.uy/escritorio/?n=${ESCRITORIO}`,
        "Accept": "application/json, text/plain, */*",
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text || text.trim() === "") throw new Error("Respuesta vacía");

    let lotes;
    try { lotes = JSON.parse(text); } catch { throw new Error("JSON inválido"); }

    return res.status(200).json({ ok: true, remate, total: lotes.length, lotes });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
