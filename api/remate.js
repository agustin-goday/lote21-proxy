// api/remate.js — Próximo remate de Lote21 leyendo archivos .ics
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // 1. Leer la página principal para extraer el número de remate actual
    const html = await fetch("https://www.lote21.uy/vivo/", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", Accept: "text/html" },
    }).then(r => r.text());

    // El número aparece en el menú como "Remate 249" o en links .ics
    const numeroMatch = html.match(/Rte_(\d+)_Dia_1\.ics/i)
      || html.match(/Remate\s+(\d+)/i)
      || html.match(/inicio\/#(\d+)/i);

    if (!numeroMatch) throw new Error("No se encontró número de remate");
    const numero = numeroMatch[1];

    // 2. Leer los archivos .ics para obtener las fechas (intentar día 1 y día 2)
    const dias = [];
    for (let d = 1; d <= 2; d++) {
      try {
        const icsUrl = `https://www.lote21.uy/inicio/calendario/Rte_${numero}_Dia_${d}.ics`;
        const ics = await fetch(icsUrl, {
          headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" },
        }).then(r => r.ok ? r.text() : null);

        if (!ics) break;

        // Extraer DTSTART del .ics: formato YYYYMMDDTHHMMSS o YYYYMMDD
        const dtMatch = ics.match(/DTSTART[^:]*:(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
        const summaryMatch = ics.match(/SUMMARY:(.+)/);

        if (dtMatch) {
          const anio = dtMatch[1], mes = dtMatch[2], dia = dtMatch[3];
          const hora = dtMatch[4] ? `${dtMatch[4]}:${dtMatch[5] || "00"}` : null;
          const MESES_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
          const nombreMes = MESES_ES[parseInt(mes) - 1];
          const DIAS_ES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
          const fecha = new Date(parseInt(anio), parseInt(mes)-1, parseInt(dia));
          const nombreDia = DIAS_ES[fecha.getDay()];
          const descripcion = `${nombreDia} ${parseInt(dia)} de ${nombreMes}${hora ? " - " + hora : ""}`;
          dias.push({ dia: String(d), descripcion, fecha: `${anio}-${mes}-${dia}` });
        }
      } catch { break; }
    }

    if (dias.length === 0) throw new Error("No se pudieron leer los archivos .ics");

    const proximoRemate = dias[0].descripcion;

    return res.status(200).json({
      ok: true,
      numero,
      dias,
      proximoRemate,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}
