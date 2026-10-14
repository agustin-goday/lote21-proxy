// api/granos.js — Precios de granos desde verdenews.com.uy/mercado-de-granos/

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

    // Fechas
    const fechaIntl = texto.match(/Mercado Internacional[^A-Z0-9]*Actualizado el ([\d\/]+ [\d:]+ hs)/i);
    const fechaNac  = texto.match(/Mercado Nacional[^A-Z0-9]*Actualizado el ([\d\/]+ [\d:]+ hs)/i);

    // Bloques
    const idxIntl = texto.indexOf("Mercado Internacional");
    const idxNac  = texto.indexOf("Mercado Nacional");
    const bloqIntl = idxIntl > -1 ? texto.substring(idxIntl, idxNac > -1 ? idxNac : idxIntl + 800) : texto;
    const bloqNac  = idxNac  > -1 ? texto.substring(idxNac,  idxNac + 1500) : "";

    // ── Internacional: "SOJA NOVIEMBRE 2026 JULIO 2027 473,91 488,42" ──
    function extraerIntl(bloque, grano) {
      const re = new RegExp(
        grano + '\\s+([A-ZÁÉÍÓÚ]+\\s+\\d{4})\\s+([A-ZÁÉÍÓÚ]+\\s+\\d{4})\\s+([\\d,\\.]+)\\s+([\\d,\\.]+)',
        'i'
      );
      const m = bloque.match(re);
      if (!m) return [];
      return [
        { posicion: m[1].trim(), precio: m[3].replace(",", ".") },
        { posicion: m[2].trim(), precio: m[4].replace(",", ".") },
      ].filter(x => x.precio && !x.precio.startsWith("0000"));
    }

    // ── Nacional: buscar el primer precio con decimales reales ──
    function extraerNac(bloque, keyword) {
      const re = new RegExp(keyword + '[\\s\\S]{0,300}?(\\d{3,4}[,\\.]\\d{2})', 'i');
      const matches = [...bloque.matchAll(new RegExp(keyword + '[\\s\\S]{0,400}?(\\d{3,4}[,\\.]\\d{2})', 'gi'))];
      const validos = matches
        .map(m => m[1].replace(",", "."))
        .filter(p => !p.startsWith("000"));
      if (!validos.length) return [];
      // Buscar posición (año campaña) más cercana
      const posM = bloque.match(new RegExp(keyword + '[\\s\\S]{0,200}?(\\d{4}\\/\\d{4})'));
      const posicion = posM ? posM[1] : "2026/2027";
      return [{ posicion, precio: validos[validos.length - 1] }];
    }

    const soja  = extraerIntl(bloqIntl, "SOJA");
    const maiz  = extraerIntl(bloqIntl, "MA[IÍ]Z");
    const trigo = extraerIntl(bloqIntl, "TRIGO");

    const local = {};
    const sojaL  = extraerNac(bloqNac, "SOJA");
    const trigoL = extraerNac(bloqNac, "TRIGO");
    const cebadaL = extraerNac(bloqNac, "CEBADA");
    const colzaL  = extraerNac(bloqNac, "COLZA");
    if (sojaL.length)   local.soja   = sojaL;
    if (trigoL.length)  local.trigo  = trigoL;
    if (cebadaL.length) local.cebada = cebadaL;
    if (colzaL.length)  local.colza  = colzaL;

    return res.status(200).json({
      ok: true,
      fechaActualizacion: fechaIntl ? fechaIntl[1].trim() : null,
      fechaNacional:      fechaNac  ? fechaNac[1].trim()  : null,
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
