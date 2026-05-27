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

  try {
    // 1. Obtener lista de remates activos
    const listRes = await fetch("https://plazarural.com.uy/remates", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", Accept: "text/html" },
    });
    const listHtml = await listRes.text();

    // Extraer todos los números de remate en orden
    const numerosMatch = [...listHtml.matchAll(/\/remates\/(\d+)/g)];
    const numeros = [...new Set(numerosMatch.map(m => parseInt(m[1])))].sort((a,b) => a - b);

    if (!numeros.length) throw new Error("No se encontraron remates");

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // 2. Recorrer remates en orden ascendente y tomar el primero con fecha >= hoy
    for (const numero of numeros) {
      try {
        const remateRes = await fetch(`https://plazarural.com.uy/remates/${numero}`, {
          headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", Accept: "text/html" },
        });
        const remateHtml = await remateRes.text();
        const texto = remateHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

        // Buscar "Jueves 14 · Viernes 15 · Mayo 2026" o "Miércoles 22 · Mayo 2026"
        const fechaMatch = texto.match(
          /(?:Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)\s+(\d+)\s*[·\-·]\s*(?:.*?)\s*(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(\d{4})/i
        );

        if (!fechaMatch) continue;

        const dia  = parseInt(fechaMatch[1]);
        const mes  = MESES[fechaMatch[2].toLowerCase()];
        const anio = parseInt(fechaMatch[3]);
        const fechaRemate = new Date(anio, mes - 1, dia);

        // Buscar la última fecha del remate (para remates de 2 días)
        const todasFechas = [...texto.matchAll(
          /(?:Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)\s+(\d+)\s*[·\-]\s*(?:.*?)\s*(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(\d{4})/gi
        )];
        let fechaFin = fechaRemate;
        for (const fm of todasFechas) {
          const d = new Date(parseInt(fm[3]), MESES[fm[2].toLowerCase()] - 1, parseInt(fm[1]));
          if (d > fechaFin) fechaFin = d;
        }

        if (fechaFin >= hoy) {
          // Este es el remate actual o próximo
          const fechaCompleta = texto.match(
            /((?:Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)\s+\d+\s*[·\-]\s*(?:.*?)\d{4})/i
          )?.[1]?.replace(/\s+/g, " ").trim();

          return res.status(200).json({
            ok: true,
            numero: String(numero),
            fechaCompleta: fechaCompleta || null,
            lugar: "Hotel Cottage de Montevideo",
            url: `https://plazarural.com.uy/remates/${numero}`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (_) { continue; }
    }

    throw new Error("No se encontró próximo remate");

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
