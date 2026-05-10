// api/promedios-lote21.js — Promedios de un remate de Lote21 agrupados por categoría

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  const remate = req.query.r;
  if (!remate) return res.status(400).json({ ok: false, error: "Falta parámetro r" });

  const anos = [2026, 2025, 2024, 2023];

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

      if (!response.ok) continue;
      const text = await response.text();
      if (!text || text.includes("<!DOCTYPE") || text.trim() === "") continue;

      let lotes;
      try { lotes = JSON.parse(text); } catch { continue; }
      if (!Array.isArray(lotes) || lotes.length === 0) continue;

      // Agrupar por categoría y calcular estadísticas
      const grupos = {};
      for (const lote of lotes) {
        const cat = lote.categoria || "Sin categoría";
        const orden = parseInt(lote.orden) || 99;
        const precio = parseFloat(lote.Costo_final);
        const peso = parseFloat(lote.Pesada_final);

        if (!grupos[cat]) {
          grupos[cat] = { categoria: cat, orden, precios: [], pesos: [] };
        }
        if (!isNaN(precio)) grupos[cat].precios.push(precio);
        if (!isNaN(peso))   grupos[cat].pesos.push(peso);
      }

      // Calcular máx, mín, promedio, bulto por categoría
      const categorias = Object.values(grupos)
        .sort((a, b) => a.orden - b.orden)
        .map(g => {
          const precios = g.precios;
          const pesos   = g.pesos;
          const promPrecio = precios.reduce((s, v) => s + v, 0) / precios.length;
          const promPeso   = pesos.reduce((s, v) => s + v, 0) / pesos.length;
          return {
            categoria:  g.categoria,
            maximo:     precios.length ? Math.max(...precios).toFixed(2) : null,
            minimo:     precios.length ? Math.min(...precios).toFixed(2) : null,
            promedio:   precios.length ? promPrecio.toFixed(2) : null,
            bulto:      pesos.length   ? promPeso.toFixed(2)   : null,
            cabezas:    precios.length,
          };
        });

      return res.status(200).json({ ok: true, remate, ano, categorias });

    } catch(e) { continue; }
  }

  return res.status(404).json({ ok: false, error: "No se encontraron promedios para el remate " + remate });
}
