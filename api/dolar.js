// api/dolar.js — Cotizaciones BROU: USD, EUR, ARS, BRL + UI/UR BCU
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(200).end();

  function parseVal(str) {
    if (!str) return null;
    const m = String(str).replace(/\s/g, '').match(/(\d{1,3}[.,]\d{2,5})/);
    if (!m) return null;
    return parseFloat(m[1].replace(',', '.'));
  }

  function fmt(n) {
    if (!n) return null;
    return n.toFixed(4).replace(/\.?0+$/, '') || n.toFixed(2);
  }

  try {
    // ── BROU cotizaciones ──
    const brouUrl = "https://www.brou.com.uy/c/portal/render_portlet?p_l_id=20593&p_p_id=cotizacionfull_WAR_broutmfportlet_INSTANCE_otHfewh1klyS&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_pos=0&p_p_col_count=1";

    const brouHtml = await fetch(brouUrl, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
    }).then(r => r.text());

    // Extraer filas de la tabla de cotizaciones
    // Formato: MONEDA ... compra ... venta
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const rows = [...brouHtml.matchAll(rowRe)];

    const cotizaciones = {};
    const MONEDAS = {
      'dólar': 'usd', 'dolar': 'usd',
      'euro': 'eur',
      'peso argentino': 'ars', 'argentino': 'ars',
      'real': 'brl', 'real brasileño': 'brl',
    };

    rows.forEach(row => {
      const tds = [...row[1].matchAll(tdRe)].map(td =>
        td[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
      );
      if (tds.length < 3) return;
      const monedaRaw = tds[0].toLowerCase();
      const key = Object.entries(MONEDAS).find(([k]) => monedaRaw.includes(k))?.[1];
      if (!key) return;
      const compra = parseVal(tds[1]);
      const venta = parseVal(tds[2]);
      if (compra && venta) cotizaciones[key] = { compra: fmt(compra), venta: fmt(venta) };
    });

    // Fallback regex directo para USD si no encontró por tabla
    if (!cotizaciones.usd) {
      const usdM = brouHtml.match(/(\d{2},\d{4,5})/g);
      if (usdM && usdM.length >= 2) {
        cotizaciones.usd = {
          compra: usdM[0].replace(',', '.'),
          venta: usdM[1].replace(',', '.')
        };
      }
    }

    // ── UI / UR — BCU ──
    let ui = null, ur = null;
    try {
      const bcuHtml = await fetch("https://www.bcu.gub.uy/Estadisticas-e-Indicadores/Paginas/Cotizaciones.aspx", {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
      }).then(r => r.text());

      const uiM = bcuHtml.match(/UI[^<]*?(\d+[.,]\d{4})/i);
      const urM = bcuHtml.match(/UR[^<]*?(\d+[.,]\d{2,4})/i);
      if (uiM) ui = parseFloat(uiM[1].replace(',', '.')).toFixed(4);
      if (urM) ur = parseFloat(urM[1].replace(',', '.')).toFixed(2);
    } catch(_) {}

    const usd = cotizaciones.usd || {};
    const fecha = new Date().toLocaleDateString('es-UY', { day: 'numeric', month: 'long' });

    return res.status(200).json({
      ok: true,
      fuente: "BROU",
      fecha,
      compra: usd.compra || null,
      venta: usd.venta || null,
      cotizaciones: {
        usd: usd,
        eur: cotizaciones.eur || null,
        ars: cotizaciones.ars || null,
        brl: cotizaciones.brl || null,
      },
      ui,
      ur,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
