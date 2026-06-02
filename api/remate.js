// api/remate.js — Próximo remate Lote21
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const html = await fetch("https://www.lote21.uy/vivo/", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", "Accept": "text/html" }
    }).then(r => r.text());

    // Número de remate
    const numeroMatch = html.match(/Remate\s+(\d+)/i)
      || html.match(/Rte_(\d+)/i);
    if (!numeroMatch) throw new Error("No se encontró número de remate");
    const numero = numeroMatch[1];

    // Estructura real del HTML de lote21:
    // <span class="color-DBBA34...">DIA 1: </span>
    // <span class="color-FFFFFF...">martes, 9 de junio – 09:00</span>
    // El guión puede ser – (largo) o - (corto)
    // Estrategia: buscar spans blancos (color-FFFFFF) que contengan fechas
    // justo después de spans dorados (color-DBBA34) que dicen "DIA N:"

    const dias = [];

    // Patrón: DIA N: seguido (en el mismo o siguiente span) por la fecha
    // El texto limpio tiene: "DIA 1: martes, 9 de junio – 09:00"
    const textoLimpio = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // Buscar "DIA 1:" y "DIA 2:" y capturar lo que sigue
    const reDia = /DIA\s+(\d+)\s*:\s*((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)[^<\n]{3,50})/gi;
    const matches = [...textoLimpio.matchAll(reDia)];

    if (matches.length > 0) {
      matches.forEach(m => {
        const desc = m[2].trim()
          .replace(/\s*[–-]\s*/g, ' - ')  // normalizar guión largo a corto
          .replace(/\s+/g, ' ')
          .trim();
        // Capitalizar primera letra
        dias.push({
          dia: m[1],
          descripcion: desc.charAt(0).toUpperCase() + desc.slice(1)
        });
      });
    } else {
      // Fallback: buscar spans con color-FFFFFF que tengan días de semana
      const spanRe = /color-FFFFFF[^>]*>([^<]*(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)[^<]*)</gi;
      const spanMatches = [...html.matchAll(spanRe)];
      spanMatches.slice(0, 2).forEach((m, i) => {
        const desc = m[1].trim()
          .replace(/\s*[–-]\s*/g, ' - ')
          .replace(/\s+/g, ' ')
          .trim();
        if (desc.length > 5) {
          dias.push({
            dia: String(i + 1),
            descripcion: desc.charAt(0).toUpperCase() + desc.slice(1)
          });
        }
      });
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
