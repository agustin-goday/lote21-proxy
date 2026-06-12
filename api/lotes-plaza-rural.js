// api/lotes-plaza-rural.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const remate = req.query.remate;
  if (!remate) return res.status(400).json({ ok: false, error: "Falta parámetro remate" });

  const ESCRITORIO_ID = 7;
  const idInterno = parseInt(remate) - 248;

  const CATEGORIAS = [
    { id: 15, nombre: "Terneros" },
    { id: 3,  nombre: "Terneras" },
    { id: 6,  nombre: "Terneros / Terneras" },
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
        if (!html.includes('<tbody>')) continue;

        // Extraer filas del tbody
        const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
        if (!tbodyMatch) continue;
        const tbody = tbodyMatch[1];

        const filas = tbody.split(/<tr[^>]*>/).slice(1);

        for (const fila of filas) {
          if (!fila.trim() || !fila.includes('<td')) continue;

          // ID interno del lote (data-view-lote o loteId en URL)
          const loteIdMatch = fila.match(/data-view-lote="(\d+)"|loteId=(\d+)/);
          const loteId = loteIdMatch ? (loteIdMatch[1] || loteIdMatch[2]) : null;

          // Extraer todas las celdas <td>
          const tds = [];
          const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
          let m;
          while ((m = tdRegex.exec(fila)) !== null) {
            // Limpiar HTML a texto plano
            const texto = m[1]
              .replace(/<[^>]+>/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            tds.push(texto);
          }

          // Estructura de columnas:
          // 0: acciones (dropdown)
          // 1: LOTE (número)
          // 2: video/vacío
          // 3: INSP.
          // 4: CAB.
          // 5: PESO
          // 6: RAZA
          // 7: DPTO.
          // 8: ESCRITORIO
          // 9: PREOFERTA
          // 10: P. VENTA
          // 11: FECHA
          // 12: E. VENTA

          if (tds.length < 8) continue;

          const nro         = tds[1] || null;
          const inspeccion  = tds[3] || null;
          const cabezas     = tds[4] || null;
          const peso        = tds[5] || null;
          const raza        = tds[6] || null;
          const departamento = tds[7] || null;

          // Preoferta: buscar badge en columna 9
          const preoMatch = fila.match(/badge-(success|warning|danger)[^>]*>([^<]+)</i);
          const preoferta = preoMatch ? preoMatch[2].trim() : null;
          const preoColor = preoMatch
            ? (preoMatch[1] === 'success' ? '#28a745' : preoMatch[1] === 'warning' ? '#fd7e14' : '#dc3545')
            : null;

          // Video: buscar URL de bunny CDN o youtube en la fila
          const videoMatch = fila.match(/href="(https?:\/\/(?:vz-[^"]*\.b-cdn\.net|youtube\.com|youtu\.be)[^"]+)"/i);
          const video = videoMatch ? videoMatch[1] : null;

          lotes.push({
            id:          loteId,
            nro:         nro,
            inspeccion:  inspeccion,
            categoria:   cat.nombre,
            categoriaId: cat.id,
            cabezas:     cabezas,
            peso:        peso,
            raza:        raza,
            departamento: departamento,
            preoferta,
            preofertaColor: preoColor,
            video,
          });
        }
      } catch (e) {
        console.error(`Error cat ${cat.nombre}:`, e.message);
      }
    }

    return res.json({ ok: true, remate: parseInt(remate), idInterno, total: lotes.length, lotes });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
