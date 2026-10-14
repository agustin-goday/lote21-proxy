// api/granos.js — Precios de granos desde verdenews.com.uy/mercado-de-granos/
// Mercado Internacional (Chicago) y Nacional Uruguay — actualizado diariamente

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const r = await fetch("https://verdenews.com.uy/mercado-de-granos/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-UY,es;q=0.9",
        "Referer": "https://verdenews.com.uy/"
      }
    });

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    const texto = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

    // ── Fecha de actualización ──
    const fechaIntl = texto.match(/Mercado Internacional[^A-Z]*Actualizado el ([\d\/]+[^h]*hs)/i);
    const fechaNac  = texto.match(/Mercado Nacional[^A-Z]*Actualizado el ([\d\/]+[^h]*hs)/i);
    const fechaActualizacion = fechaIntl ? fechaIntl[1].trim() : null;

    // ── Parsear tablas ──
    // Formato en el texto limpio:
    // "SOJA NOVIEMBRE 2026 JULIO 2027 473,91 488,42"
    // "MAÍZ DICIEMBRE 2026 MARZO 2027 189,16 194,87"
    // "TRIGO DICIEMBRE 2026 MARZO 2027 244,62 249,86"

    function extraerGranoIntl(texto, grano) {
      const re = new RegExp(
        grano + '\\s+([A-ZÁÉÍÓÚ]+\\s+\\d{4})\\s+([A-ZÁÉÍÓÚ]+\\s+\\d{4})\\s+([\\d,\\.]+)\\s+([\\d,\\.]+)',
        'i'
      );
      const m = texto.match(re);
      if (!m) return [];
      return [
        { posicion: m[1].trim(), precio: m[3].replace(",", ".") },
        { posicion: m[2].trim(), precio: m[4].replace(",", ".") },
      ].filter(x => x.precio && x.precio !== "00000");
    }

    // ── Internacional ──
    // Buscar bloque entre "Mercado Internacional" y "Mercado Nacional"
    const idxIntl = texto.indexOf("Mercado Internacional");
    const idxNac  = texto.indexOf("Mercado Nacional");
    const bloqIntl = idxIntl > -1
      ? texto.substring(idxIntl, idxNac > -1 ? idxNac : idxIntl + 1000)
      : texto;

    const soja  = extraerGranoIntl(bloqIntl, "SOJA");
    const maiz  = extraerGranoIntl(bloqIntl, "MA[IÍ]Z");
    const trigo = extraerGranoIntl(bloqIntl, "TRIGO");

    // ── Nacional (Uruguay) ──
    const bloqNac = idxNac > -1 ? texto.substring(idxNac, idxNac + 1500) : "";

    function extraerGranoNac(bloque, keyword) {
      // Busca patrones como "2026/2027 441,00" o "2025/2026 220,00"
      const re = new RegExp(
        keyword + '[\\s\\S]{0,200}?(\\d{4}\\/\\d{4})\\s+([\\d,\\.]+)',
        'i'
      );
      const m = bloque.match(re);
      if (!m || m[2] === "00000") return [];
      return [{ posicion: m[1], precio: m[2].replace(",", ".") }];
    }

    const local = {
      soja:   extraerGranoNac(bloqNac, "SOJA"),
      trigo:  extraerGranoNac(bloqNac, "TRIGO"),
      cebada: extraerGranoNac(bloqNac, "CEBADA"),
    };

    // Colza
    const colzaM = bloqNac.match(/COLZA[\s\S]{0,100}?(\d{4}\/\d{4})\s+([\d,\.]+)/i);
    if (colzaM && colzaM[2] !== "00000") {
      local.colza = [{ posicion: colzaM[1], precio: colzaM[2].replace(",", ".") }];
    }

    return res.status(200).json({
      ok: true,
      fechaActualizacion,
      fechaNacional: fechaNac ? fechaNac[1].trim() : null,
      internacional: { soja, maiz, trigo },
      local,
      fuente: "Verdenews — Mercado de Granos Uruguay",
      fuenteUrl: "https://verdenews.com.uy/mercado-de-granos/",
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
