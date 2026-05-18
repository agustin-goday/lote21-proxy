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

      // Agrupar por categoría — solo registros actual=1 (igual que Lote21)
      const grupos = {};
      for (const lote of lotes) {
        const cat    = lote.categoria || "Sin categoría";
        const orden  = parseInt(lote.orden) || 99;
        const precio = parseFloat(String(lote.Costo_final).replace(",","."));
        const peso   = parseFloat(lote.Pesada_final);
        const actual = lote.actual === "1" || lote.actual === 1;

        if (!grupos[cat]) {
          grupos[cat] = { categoria: cat, orden, todos: [], actuales: [] };
        }
        // Todos los registros para max/min
        if (!isNaN(precio)) grupos[cat].todos.push({ precio, peso });
        // Solo actual=1 para promedio y bulto
        if (actual && !isNaN(precio) && !isNaN(peso)) {
          grupos[cat].actuales.push({ precio, peso });
        }
      }

      // Calcular estadísticas igual que Lote21
      const categorias = Object.values(grupos)
        .sort((a, b) => a.orden - b.orden)
        .map(g => {
          const todos    = g.todos.map(x => x.precio);
          const actuales = g.actuales;
          const n = actuales.length;
          if (n === 0 && todos.length === 0) return null;

          // Promedio simple de actual=1
          const promedio = n > 0
            ? (actuales.reduce((s, x) => s + x.precio, 0) / n)
            : (todos.reduce((s, x) => s + x, 0) / todos.length);

          // Bulto = promedio de (precio * peso) de actual=1
          const bulto = n > 0
            ? actuales.reduce((s, x) => s + x.precio * x.peso, 0) / n
            : null;

          return {
            categoria: g.categoria,
            maximo:    todos.length ? Math.max(...todos).toFixed(2) : null,
            minimo:    todos.length ? Math.min(...todos).toFixed(2) : null,
            promedio:  promedio.toFixed(2),
            bulto:     bulto ? bulto.toFixed(2) : null,
            cabezas:   n || todos.length,
          };
        })
        .filter(Boolean);

      return res.status(200).json({ ok: true, remate, ano, categorias });

    } catch(e) { continue; }
  }

  return res.status(404).json({ ok: false, error: "No se encontraron promedios para el remate " + remate });
}
