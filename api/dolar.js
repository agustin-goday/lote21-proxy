// api/dolar.js — Cotizaciones BROU: USD, EUR, ARS, BRL + UI/UR BCU
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(200).end();

  function fmt2(val) {
    if (!val && val !== 0) return null;
    const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    if (isNaN(n)) return null;
    return n.toFixed(2);
  }

  function extractVal(str) {
    if (!str) return null;
    const clean = str.replace(/\s/g, '').replace(',', '.');
    const m = clean.match(/(\d{1,4}\.\d{2,6})/);
    return m ? parseFloat(m[1]) : null;
  }

  try {
    // ── BROU — página principal de cotizaciones ──
    const brouHtml = await fetch("https://www.brou.com.uy/web/guest/cotizaciones", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", "Accept": "text/html" }
    }).then(r => r.text());

    // Buscar filas de la tabla con las monedas
    // Formato típico: <td>Dólar EE.UU.</td><td>39,05</td><td>41,45</td>
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRe = /<td[^>]*>([^<]*)<\/td>/gi;

    const BUSCAR = {
      usd: ['dólar', 'dolar', 'ee.uu', 'eeuu', 'estados unidos'],
      eur: ['euro'],
      ars: ['argentino', 'argentina'],
      brl: ['real', 'brasil', 'brasileño'],
    };

    const cotizaciones = { usd: null, eur: null, ars: null, brl: null };

    for (const rowMatch of brouHtml.matchAll(rowRe)) {
      const cells = [...rowMatch[1].matchAll(tdRe)].map(td =>
        td[1].replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').trim().toLowerCase()
      );
      if (cells.length < 3) continue;
      const moneda = cells[0];
      for (const [key, terms] of Object.entries(BUSCAR)) {
        if (cotizaciones[key]) continue;
        if (terms.some(t => moneda.includes(t))) {
          const compra = extractVal(cells[1]);
          const venta = extractVal(cells[2]);
          if (compra && venta) {
            cotizaciones[key] = { compra: fmt2(compra), venta: fmt2(venta) };
          }
        }
      }
    }

    // Fallback para USD si la tabla no lo dio: usar el portlet original
    if (!cotizaciones.usd) {
      const portletUrl = "https://www.brou.com.uy/c/portal/render_portlet?p_l_id=20593&p_p_id=cotizacionfull_WAR_broutmfportlet_INSTANCE_otHfewh1klyS&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_pos=0&p_p_col_count=1";
      const portletHtml = await fetch(portletUrl, {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
      }).then(r => r.text());
      const nums = portletHtml.match(/\d{2},\d{4,5}/g);
      if (nums && nums.length >= 2) {
        cotizaciones.usd = {
          compra: fmt2(nums[0].replace(',', '.')),
          venta: fmt2(nums[1].replace(',', '.'))
        };
      }
    }

    // ── UI / UR — BCU ──
    let ui = null, ur = null;
    try {
      const bcuHtml = await fetch("https://www.bcu.gub.uy/Estadisticas-e-Indicadores/Paginas/Cotizaciones.aspx", {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
      }).then(r => r.text());

      // Buscar UI y UR en la página
      const uiM = bcuHtml.match(/Unidad Indexada[\s\S]{0,200}?(\d+[.,]\d{4})/i);
      const urM = bcuHtml.match(/Unidad Reajustable[\s\S]{0,200}?(\d+[.,]\d{2,4})/i);
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
      cotizaciones,
      ui,
      ur,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
