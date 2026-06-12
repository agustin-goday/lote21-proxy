// api/lotes-plaza-rural.js
// Devuelve los lotes de Aramburu (escritorio_id=7) para un remate de Plaza Rural.
// FIX: El ID interno de Plaza Rural ES el mismo número público del remate.
//      La fórmula anterior (remate - 248) era incorrecta.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const remate = req.query.remate;
  if (!remate) {
    return res.status(400).json({ ok: false, error: "Falta parámetro remate" });
  }

  const ESCRITORIO_ID = 7; // Aramburu
  const TOKEN = "dxAkpnxQnWSIWopkJYMpHAiHkT58qV1uxQYFy9RV";

  // El ID interno de Plaza Rural es el mismo número público del remate
  // (confirmado desde el HTML de portada: href="/remates/324" para el remate 324)
  const idInterno = parseInt(remate);

  const CATEGORIAS = [
    { id: 15, nombre: "Terneros" },
    { id: 3,  nombre: "Terneras" },
    { id: 6,  nombre: "Terneros/as" },
    { id: 14, nombre: "Novillos 1-2 años" },
    { id: 13, nombre: "Novillos 2-3 años" },
    { id: 7,  nombre: "Vacas de Invernada" },
    { id: 2,  nombre: "Vaquillonas 1-2 años" },
    { id: 1,  nombre: "Vaquillonas +2 años" },
    { id: 4,  nombre: "Vientres Preñados" },
    { id: 5,  nombre: "Vientres Entorados" },
    { id: 9,  nombre: "Piezas de Cría" },
    { id: 35, nombre: "Más de 1 año enteros" },
    { id: 8,  nombre: "Toros" },
  ];

  try {
    const lotes = [];

    for (const cat of CATEGORIAS) {
      const url = `https://plazarural.com.uy/table-categoria/${idInterno}/${cat.id}?escritorio_id=${ESCRITORIO_ID}&&&&&`;
      try {
        const html = await fetch(url).then(r => r.text());

        // Si no hay filas de lotes, saltar esta categoría
        if (!html.includes('<tr') || html.includes('No hay lotes')) continue;

        // Extraer filas <tr> con datos
        const filaRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let fila;
        while ((fila = filaRegex.exec(html)) !== null) {
          const contenido = fila[1];

          // Ignorar filas de encabezado (tienen <th>)
          if (contenido.includes('<th')) continue;

          // Extraer celdas <td>
          const tds = [];
          const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
          let tdMatch;
          while ((tdMatch = tdRegex.exec(contenido)) !== null) {
            // Limpiar HTML interno a texto plano
            tds.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
          }
          if (tds.length < 2) continue;

          // Extraer ID del lote desde el link
          const idMatch = contenido.match(/\/lotes\/(\d+)|loteId=(\d+)|data-id="(\d+)"/);
          const loteId = idMatch ? (idMatch[1] || idMatch[2] || idMatch[3]) : null;

          // Extraer número visible del lote
          const nroMatch = contenido.match(/class="[^"]*nro[^"]*"[^>]*>(\d+)<|>(\d+)<\/a>|Lote\s+(\d+)/i);
          const nro = nroMatch ? (nroMatch[1] || nroMatch[2] || nroMatch[3]) : (tds[0] || loteId);

          // Extraer preoferta si existe
          const preoMatch = contenido.match(/class="[^"]*badge[^"]*badge-(success|warning|danger)[^"]*"[^>]*>([^<]+)</i);
          const preoferta = preoMatch ? preoMatch[2].trim() : null;
          const preoColor = preoMatch ? (preoMatch[1] === 'success' ? '#28a745' : preoMatch[1] === 'warning' ? '#fd7e14' : '#dc3545') : null;

          // Extraer video
          const videoMatch = contenido.match(/href="(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^"]+)"/i);
          const video = videoMatch ? videoMatch[1] : null;

          lotes.push({
            id:          loteId,
            nro:         nro,
            categoria:   cat.nombre,
            categoriaId: cat.id,
            cabezas:     tds[1] || null,
            peso:        tds[2] || null,
            clase:       tds[3] || null,
            estado:      tds[4] || null,
            departamento: tds[5] || null,
            preoferta,
            preofertaColor: preoColor,
            video,
          });
        }
      } catch (e) {
        console.error(`Error categoría ${cat.nombre}:`, e.message);
      }
    }

    return res.json({
      ok:        true,
      remate:    parseInt(remate),
      idInterno: idInterno,
      total:     lotes.length,
      lotes,
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
