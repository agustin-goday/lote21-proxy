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
      }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    const texto = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

    const idxIntl = texto.indexOf("Mercado Internacional");
    const idxNac  = texto.indexOf("Mercado Nacional");
    const bloqIntl = idxIntl > -1 ? texto.substring(idxIntl, idxNac > -1 ? idxNac : idxIntl + 800) : "";
    const bloqNac  = idxNac  > -1 ? texto.substring(idxNac, idxNac + 1500) : "";

    // ── Fecha internacional ──
    const fechaIntl = bloqIntl.match(/Actualizado el ([\d\/]+ [\d:]+ hs)/i);
    const fechaNac  = bloqNac.match(/Actualizado el ([\d\/]+ [\d:]+ hs)/i);

    // ── Internacional: fila Posición + fila Último ──
    // Formato: "SOJA MAÍZ TRIGO Posición NOVIEMBRE 2026 JULIO 2027 ... Último 473,91 488,42 ..."
    const posM = bloqIntl.match(/Posici[oó]n\s+([\s\S]+?)\s+[ÚU]ltimo/i);
    const ultM = bloqIntl.match(/[ÚU]ltimo\s+([\s\S]+?)\s+Variaci/i);

    const internacional = { soja: [], maiz: [], trigo: [] };

    if (posM && ultM) {
      const posiciones = posM[1].trim().match(/[A-ZÁÉÍÓÚ]+\s+\d{4}/g) || [];
      const precios    = ultM[1].trim().match(/[\d]+[,\.][\d]+/g) || [];
      const nombres    = ['soja', 'maiz', 'trigo'];
      nombres.forEach((g, i) => {
        const p1  = posiciones[i*2]   ? posiciones[i*2].trim()   : null;
        const p2  = posiciones[i*2+1] ? posiciones[i*2+1].trim() : null;
        const pr1 = precios[i*2]      ? precios[i*2].replace(",", ".")   : null;
        const pr2 = precios[i*2+1]    ? precios[i*2+1].replace(",", ".") : null;
        if (p1 && pr1) internacional[g].push({ posicion: p1, precio: pr1 });
        if (p2 && pr2) internacional[g].push({ posicion: p2, precio: pr2 });
      });
    }

    // ── Nacional ──
    function extraerNac(bloque, keyword) {
      const re = new RegExp(keyword + '[\\s\\S]{0,400}?(\\d{3,4}[,\\.]\\d{2})', 'gi');
      const matches = [...bloque.matchAll(re)];
      const validos = matches.map(m => m[1].replace(",", ".")).filter(p => !p.startsWith("000"));
      if (!validos.length) return [];
      const posM2 = bloque.match(new RegExp(keyword + '[\\s\\S]{0,200}?(\\d{4}\\/\\d{4})', 'i'));
      return [{ posicion: posM2 ? posM2[1] : "2026/2027", precio: validos[validos.length - 1] }];
    }

    const local = {};
    const sojaL   = extraerNac(bloqNac, "SOJA");
    const trigoL  = extraerNac(bloqNac, "TRIGO");
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
      internacional,
      local,
      fuente: "Verdenews — Mercado de Granos Uruguay",
      fuenteUrl: "https://verdenews.com.uy/mercado-de-granos/",
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
