// api/remate.js — Próximo remate Lote21 scrapeando HTML directamente
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const html = await fetch("https://www.lote21.uy/vivo/", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", "Accept": "text/html" }
    }).then(r => r.text());

    // Extraer número de remate
    const numeroMatch = html.match(/Remate\s+(\d+)/i)
      || html.match(/Rte_(\d+)/i)
      || html.match(/remate[_\s]+(\d+)/i);
    if (!numeroMatch) throw new Error("No se encontró número de remate");
    const numero = numeroMatch[1];

    // Extraer días — Lote21 los muestra como:
    // "DIA 1: MARTES, 9 DE JUNIO - 09:00" y "DIA 2: MIÉRCOLES, 10 DE JUNIO - 09:00"
    const diasRaw = [...html.matchAll(/DIA\s+(\d+)\s*:\s*([^<"'\n]{5,60}?)(?:\s*[-–]\s*(\d{2}:\d{2}))?(?=[<"'\s]|$)/gi)];

    const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const DIAS_ES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

    function formatDesc(raw) {
      // "MARTES, 9 DE JUNIO - 09:00" → "martes 9 de junio - 09:00"
      if (!raw) return '';
      return raw.trim()
        .replace(/,\s*/g, ' ')
        .replace(/\s+DE\s+/gi, ' de ')
        .replace(/\b([A-ZÁÉÍÓÚÜ]+)\b/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .replace(/\s+/g, ' ')
        .trim();
    }

    let dias = [];

    if (diasRaw.length > 0) {
      // Encontró el patrón "DIA 1: ..."
      dias = diasRaw.map(m => ({
        dia: m[1],
        descripcion: formatDesc(m[2] + (m[3] ? ' - ' + m[3] : ''))
      }));
    } else {
      // Fallback: buscar fechas con patrón DIAX, MES en el HTML limpio
      const textoLimpio = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      
      // Buscar "MARTES, 9 DE JUNIO - 09:00" o "MARTES, 9 DE JUNIO"
      const meses = MESES.join('|');
      const re = new RegExp(
        '(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)[,\\s]+(\\d{1,2})\\s+de\\s+(' + meses + ')(?:\\s*[-–]\\s*(\\d{2}:\\d{2}))?',
        'gi'
      );
      const fechas = [...textoLimpio.matchAll(re)];
      const unicas = [...new Set(fechas.map(m => m[0].trim()))];
      dias = unicas.slice(0, 2).map((f, i) => ({
        dia: String(i + 1),
        descripcion: f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()
      }));
    }

    if (dias.length === 0) throw new Error("No se encontraron días");

    return res.status(200).json({
      ok: true,
      numero,
      dias,
      proximoRemate: dias[0].descripcion,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, timestamp: new Date().toISOString() });
  }
}
