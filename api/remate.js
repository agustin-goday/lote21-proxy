// api/remate.js — Vercel Serverless Function

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch("https://www.lote21.uy/vivo/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-UY,es;q=0.9",
      },
    });

    const html = await response.text();

    // Número de remate
    const numeroMatch = html.match(/Remate\s+(\d+)/i);
    const numero = numeroMatch ? numeroMatch[1] : null;

    // Limpiar HTML
    const texto = html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");

    // Estrategia: buscar todas las fechas con formato "dia_semana, DD de mes - HH:MM"
    // Ej: "jueves, 21 de mayo - 09:00" o "viernes, 22 de mayo - 09:00"
    const diasSemana = "lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo";
    const meses = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre";
    const regexFecha = new RegExp(
      `((?:${diasSemana}),?\\s*\\d{1,2}\\s+de\\s+(?:${meses})\\s*[-–]\\s*\\d{1,2}:\\d{2})`,
      "gi"
    );

    const fechasEncontradas = [...texto.matchAll(regexFecha)].map(m => m[1].trim());

    // Deduplicar
    const fechasUnicas = [...new Set(fechasEncontradas)];

    // Construir dias
    const dias = fechasUnicas.map((f, i) => ({ dia: String(i + 1), descripcion: f }));

    // proximoRemate = primera fecha
    const proximoRemate = fechasUnicas[0] || null;

    if (!numero && dias.length === 0) {
      return res.status(200).json({
        ok: false,
        error: "No se encontraron datos",
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      ok: true,
      numero,
      dias,
      proximoRemate,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
