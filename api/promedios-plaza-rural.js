// api/promedios-plaza-rural.js
// Extrae promedios de Plaza Rural por número de remate via scraping HTML

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  const remate = req.query.r;
  if (!remate) return res.status(400).json({ ok: false, error: "Falta parámetro r" });

  try {
    const response = await fetch(`https://plazarural.com.uy/promedios?nro_remate=${remate}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
        "Accept": "text/html",
        "Referer": "https://plazarural.com.uy/promedios",
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // Extraer número de remate real (puede redirigir a otro)
    const tituloMatch = html.match(/PROMEDIOS\s+REMATE\s+(\d+)/i);
    const remateReal = tituloMatch ? tituloMatch[1] : remate;

    // Extraer filas de la tabla
    const categorias = [];
    const rowRegex = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const limpiar = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').trim();
      const cat = limpiar(match[1]);
      if (!cat || cat === 'Categoría' || cat.length === 0) continue;

      categorias.push({
        categoria:  cat,
        cabezas:    limpiar(match[2]),
        lotes:      limpiar(match[3]),
        maximo:     limpiar(match[4]),
        minimo:     limpiar(match[5]),
        promedio:   limpiar(match[6]),
        promBulto:  limpiar(match[7]),
        pctVentas:  limpiar(match[8]),
      });
    }

    if (categorias.length === 0) throw new Error("No se encontraron datos en la tabla");

    return res.status(200).json({ ok: true, remate, remateReal, categorias });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
