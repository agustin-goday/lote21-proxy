// api/plazarural.js — Encuentra el próximo remate de Plaza Rural por fecha
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  const MESES = {
    "enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,
    "julio":7,"agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12
  };

  const DIAS_SEMANA = "Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo";
  const MESES_STR   = "Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre";

  try {
    const listRes = await fetch("https://plazarural.com.uy/remates", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", Accept: "text/html" },
    });
    const listHtml = await listRes.text();

    const numerosMatch = [...listHtml.matchAll(/\/remates\/(\d+)/g)];
    const numeros = [...new Set(numerosMatch.map(m => parseInt(m[1])))].sort((a, b) => a - b);
    if (!numeros.length) throw new Error("No se encontraron remates");

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (const numero of numeros) {
      try {
        const remateRes = await fetch(`https://plazarural.com.uy/remates/${numero}`, {
          headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", Accept: "text/html" },
        });
        const remateHtml = await remateRes.text();
        const texto = remateHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

        // Captura el bloque completo de fecha: "Jueves 18 · Viernes 19 · Junio 2026"
        // o también "Martes 26 · Mayo 2026" (un solo día)
        const bloqueRegex = new RegExp(
          `((?:${DIAS_SEMANA})(?:\\s+\\d{1,2}\\s*[\\u00b7\\-·]\\s*)+(?:${DIAS_SEMANA})\\s+)?(\\d{1,2})\\s*[\\u00b7\\-·]?\\s*(${MESES_STR})\\s+(\\d{4})`,
          "i"
        );

        // Regex más directo: busca todos los números de día seguidos del mes/año
        // Ejemplo match: "Jueves 18 · Viernes 19 · Junio 2026"
        const fechaBloqueRegex = new RegExp(
          `((?:${DIAS_SEMANA})\\s+\\d{1,2}(?:\\s*[\\u00b7·\\-]\\s*(?:${DIAS_SEMANA})\\s+\\d{1,2})*)\\s*[\\u00b7·\\-]?\\s*(${MESES_STR})\\s+(\\d{4})`,
          "i"
        );

        const fechaMatch = texto.match(fechaBloqueRegex);
        if (!fechaMatch) continue;

        const mesNombre = fechaMatch[2].toLowerCase();
        const mes  = MESES[mesNombre];
        const anio = parseInt(fechaMatch[3]);
        const bloquesDias = fechaMatch[1]; // "Jueves 18 · Viernes 19"

        // Extraer todos los números del bloque de días y tomar el mayor
        const todosLosDias = [...bloquesDias.matchAll(/\b(\d{1,2})\b/g)].map(m => parseInt(m[1]));
        const diaFin = todosLosDias.length ? Math.max(...todosLosDias) : 1;

        const fechaFin = new Date(anio, mes - 1, diaFin);
        if (fechaFin >= hoy) {
          // Construir fechaCompleta limpia desde el match
          const fechaCompleta = `${fechaMatch[1].trim()} · ${fechaMatch[2]} ${fechaMatch[3]}`;

          return res.status(200).json({
            ok: true,
            numero: String(numero),
            fechaCompleta: fechaCompleta,
            lugar: "Hotel Cottage de Montevideo",
            url: `https://plazarural.com.uy/remates/${numero}`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch { continue; }
    }

    throw new Error("No se encontró próximo remate");
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
