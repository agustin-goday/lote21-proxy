// api/lotes-plaza-rural.js
// Devuelve los lotes de Aramburu (escritorio_id=7) para un remate de Plaza Rural dado
// FIX: El ID interno ya no se calcula con fórmula fija (remate - 248).
//      Ahora se descubre dinámicamente consultando la página del remate en Plaza Rural.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const remate = req.query.remate;
  if (!remate) {
    return res.status(400).json({ ok: false, error: "Falta parámetro remate" });
  }

  const ESCRITORIO_ID = 7; // Aramburu
  const TOKEN = "dxAkpnxQnWSIWopkJYMpHAiHkT58qV1uxQYFy9RV";

  // Categorías de Plaza Rural con sus IDs
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
    // ── PASO 1: Descubrir el ID interno del remate ──────────────────────────
    // Plaza Rural usa un ID interno distinto al número público de remate.
    // Lo obtenemos scrapeando la página del remate y buscando la primera URL
    // con el patrón /table-categoria/{idInterno}/{catId}
    const urlRemate = `https://plazarural.com.uy/remates/${remate}?_token=${TOKEN}&escritorio_id=${ESCRITORIO_ID}`;
    const htmlRemate = await fetch(urlRemate).then(r => r.text());

    // Buscar patrón: table-categoria/NNNNN/XX o table-categoria/NN/XX
    const matchId = htmlRemate.match(/table-categoria\/(\d+)\/\d+/);
    if (!matchId) {
      return res.status(404).json({
        ok: false,
        error: `No se encontró ID interno para el remate ${remate}. Puede que no tenga lotes inscriptos aún, o que el número de remate sea incorrecto.`
      });
    }
    const idInterno = matchId[1];

    // ── PASO 2: Buscar lotes en cada categoría ──────────────────────────────
    const lotes = [];

    for (const cat of CATEGORIAS) {
      const url = `https://plazarural.com.uy/table-categoria/${idInterno}/${cat.id}?escritorio_id=${ESCRITORIO_ID}&&&&&`;
      try {
        const html = await fetch(url).then(r => r.text());
        // Extraer filas de lotes
        const filaRegex = /<tr[^>]*data-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi;
        let fila;
        while ((fila = filaRegex.exec(html)) !== null) {
          const loteId = fila[1];
          const contenido = fila[2];

          // Número de lote
          const numMatch = contenido.match(/\/lotes\/(\d+)/);
          const numero = numMatch ? numMatch[1] : loteId;

          // Descripción (primer td de texto)
          const descMatch = contenido.match(/<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/);
          const descripcion = descMatch ? descMatch[1].trim() : "";

          // Cantidad
          const cantMatch = contenido.match(/<td[^>]*class="[^"]*cantidad[^"]*"[^>]*>(\d+)<\/td>/i);
          const cantidad = cantMatch ? parseInt(cantMatch[1]) : null;

          // Departamento
          const deptoMatch = contenido.match(/<td[^>]*class="[^"]*departamento[^"]*"[^>]*>([^<]+)<\/td>/i);
          const departamento = deptoMatch ? deptoMatch[1].trim() : "";

          // Preoferta
          const preoMatch = contenido.match(/class="[^"]*badge[^"]*"[^>]*>([^<]+)<\/span>/i);
          const preoferta = preoMatch ? preoMatch[1].trim() : null;

          // Color de preoferta
          let preoColor = null;
          if (contenido.includes("badge-success") || contenido.includes("success")) preoColor = "green";
          else if (contenido.includes("badge-warning") || contenido.includes("warning")) preoColor = "orange";

          // Video URL
          const videoMatch = contenido.match(/href="(https?:\/\/[^"]*(?:youtube|youtu\.be|vimeo)[^"]*)"/i);
          const video = videoMatch ? videoMatch[1] : null;

          lotes.push({
            id: loteId,
            numero,
            categoria: cat.nombre,
            categoriaId: cat.id,
            descripcion,
            cantidad,
            departamento,
            preoferta,
            preoColor,
            video,
            urlDetalle: `https://plazarural.com.uy/lotes/${numero}`,
          });
        }
      } catch (e) {
        // Si falla una categoría, continuamos con las demás
        console.error(`Error categoría ${cat.nombre}:`, e.message);
      }
    }

    return res.json({
      ok: true,
      remate: parseInt(remate),
      idInterno: parseInt(idInterno),
      total: lotes.length,
      lotes,
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
