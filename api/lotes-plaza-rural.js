// api/lotes-plaza-rural.js
// Extrae todos los lotes de Aramburu para un remate dado de Plaza Rural

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  const remate = req.query.remate;
  if (!remate) return res.status(400).json({ ok: false, error: "Falta parámetro remate" });

  const ESCRITORIO_ID = 7; // Aramburu

  // ID interno = número de remate - 248 (321→73, 322→74)
  const idInterno = parseInt(remate) - 248;

  // Categorías de Plaza Rural con sus IDs
  const CATEGORIAS = [
    { id: 15, nombre: "Terneros" },
    { id: 14, nombre: "Terneras" },
    { id: 13, nombre: "Novillos 1-2 años" },
    { id: 12, nombre: "Novillos 2-3 años" },
    { id: 11, nombre: "Novillos +3 años" },
    { id: 8,  nombre: "Vaquillonas 1-2 años" },
    { id: 7,  nombre: "Vaquillonas +2 años" },
    { id: 16, nombre: "Vacas de Invernada" },
    { id: 3,  nombre: "Vientres Preñados" },
    { id: 4,  nombre: "Vientres Entorados" },
    { id: 1,  nombre: "Toros" },
  ];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Referer": `https://plazarural.com.uy/remates/${remate}`,
  };

  const lotesTodos = [];

  // Obtener lotes por categoría
  for (const cat of CATEGORIAS) {
    try {
      const url = `https://plazarural.com.uy/table-categoria/${idInterno}/${cat.id}?escritorio_id=${ESCRITORIO_ID}&&&&&`;
      const r = await fetch(url, { headers });
      if (!r.ok) continue;
      const html = await r.text();

      // Extraer IDs de lotes del HTML
      const idMatches = [...html.matchAll(/data-view-lote="(\d+)"/g)];
      const ids = [...new Set(idMatches.map(m => m[1]))];

      for (const loteId of ids) {
        // Extraer datos básicos de la tabla
        const nroMatch = html.match(new RegExp(`data-lote="${loteId}"[^>]*>\\s*<b>(\\d+)</b>`));
        const nro = nroMatch ? nroMatch[1] : "?";

        // Extraer fila completa del lote
        const rowRegex = new RegExp(`data-view-lote="${loteId}">(\\d+)<\\/td>[\\s\\S]*?data-view-lote="${loteId}">(\\d+)<\\/td>`, 'g');
        
        // Extraer cabezas y peso directamente
        const cabMatch = html.match(new RegExp(`data-view-lote="${loteId}">(\\d+)<\\/td>\\s*<td data-view-lote="${loteId}">(\\d+)<\\/td>`));
        const cabezas = cabMatch ? cabMatch[1] : null;
        const peso    = cabMatch ? cabMatch[2] : null;

        // Extraer raza
        const razaMatch = html.match(new RegExp(`data-view-lote="${loteId}" title="([^"]+)"`));
        const raza = razaMatch ? razaMatch[1] : null;

        // Extraer departamento
        const dptMatch = html.match(new RegExp(`data-view-lote="${loteId}">(\\w[^<]{2,30})<\\/td>\\s*<td data-view-lote="${loteId}" style`));
        const departamento = dptMatch ? dptMatch[1].trim() : null;

        lotesTodos.push({
          id: loteId,
          nro,
          categoria: cat.nombre,
          categoriaId: cat.id,
          cabezas,
          peso,
          raza,
          departamento,
          videoUrl: null, // se obtiene del modal
        });
      }
    } catch (_) { continue; }
  }

  if (lotesTodos.length === 0) {
    return res.status(200).json({ ok: false, error: "No se encontraron lotes para este remate y escritorio" });
  }

  // Obtener URL de video para cada lote desde el modal
  const lotes = await Promise.all(lotesTodos.map(async (lote) => {
    try {
      const modalRes = await fetch(`https://plazarural.com.uy/modal-lote/${lote.id}`, { headers });
      const modalHtml = await modalRes.text();

      // Extraer URL de descarga del video (BunnyCDN)
      const videoMatch = modalHtml.match(/href="(https:\/\/vz-[^"]+)"\s+download/);
      const videoUrl = videoMatch ? videoMatch[1] : null;

      // Extraer datos del modal
      const cabMatch   = modalHtml.match(/CABEZAS\s*<br>\s*<span[^>]*>(\d+)<\/span>/);
      const pesoMatch  = modalHtml.match(/PESO\s*<br>\s*<span[^>]*>(\d+)/);
      const claseMatch = modalHtml.match(/CLASE\s*<br>\s*<span[^>]*>([^<]+)<\/span>/);
      const estadoMatch= modalHtml.match(/ESTADO\s*<br>\s*<span[^>]*>([^<]+)<\/span>/);
      const dptMatch   = modalHtml.match(/<h2 class="h4 font-weight-bold">\s*([^<]+)<\/h2>/);
      const estabMatch = modalHtml.match(/<b>Establecimiento:<\/b>\s*<span>([^<]+)<\/span>/);

      // Observaciones — pestaña OBSERVACIONES
      const obsMatch = modalHtml.match(/<p class="mb-0 font-weight-bold">Observaciones:<\/p>\s*<p>([\s\S]*?)<\/p>/);
      const observaciones = obsMatch ? obsMatch[1].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim() : null;

      return {
        ...lote,
        cabezas:       cabMatch   ? cabMatch[1]          : lote.cabezas,
        peso:          pesoMatch  ? pesoMatch[1]         : lote.peso,
        clase:         claseMatch ? claseMatch[1].trim() : null,
        estado:        estadoMatch? estadoMatch[1].trim(): null,
        departamento:  dptMatch   ? dptMatch[1].trim()   : lote.departamento,
        establecimiento: estabMatch ? estabMatch[1].trim() : null,
        observaciones,
        videoUrl,
      };
    } catch (_) {
      return lote;
    }
  }));

  // Ordenar por número de lote
  lotes.sort((a, b) => parseInt(a.nro) - parseInt(b.nro));

  return res.status(200).json({
    ok: true,
    remate,
    total: lotes.length,
    lotes,
    timestamp: new Date().toISOString(),
  });
}
