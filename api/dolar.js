// api/dolar.js — BROU portal scraping con coma decimal
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  const BROU_URL = 'https://www.brou.com.uy/c/portal/render_portlet?p_l_id=20593&p_p_id=cotizacionfull_WAR_broutmfportlet_INSTANCE_otHfewh1klyS&p_p_lifecycle=0&p_t_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_pos=0&p_p_col_count=2&p_p_isolated=1&currentURL=%2Fweb%2Fguest%2Fcotizaciones';

  try {
    const r = await fetch(BROU_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.brou.com.uy/web/guest/cotizaciones'
      }
    });

    const html = await r.text();

    // Los valores tienen formato: 39,15000 con coma decimal
    // Buscar el bloque de Dólar (primer <tr> con USD) y extraer compra/venta
    const dollarBlock = html.match(/Dólar<\/p>[\s\S]*?<\/tr>/i);
    if (dollarBlock) {
      // Extraer todos los valores numéricos con coma del bloque del dólar
      const valores = dollarBlock[0].match(/>\s*(\d{1,3},\d{2,5})\s*</g) || [];
      const nums = valores
        .map(v => parseFloat(v.replace(/[><\s]/g, '').replace(',', '.')))
        .filter(n => n >= 35 && n <= 55);

      if (nums.length >= 2) {
        return res.status(200).json({
          ok: true,
          fuente: 'BROU',
          compra: nums[0].toFixed(2),
          venta:  nums[1].toFixed(2),
          fecha: new Date().toISOString().slice(0,10),
          timestamp: new Date().toISOString()
        });
      }
    }

    // Fallback: extraer todos los valores con coma del HTML completo
    const todosValores = html.match(/>\s*(\d{2},\d{4,5})\s*</g) || [];
    const nums = todosValores
      .map(v => parseFloat(v.replace(/[><\s]/g,'').replace(',','.')))
      .filter(n => n >= 35 && n <= 55);

    if (nums.length >= 2) {
      return res.status(200).json({
        ok: true,
        fuente: 'BROU',
        compra: nums[0].toFixed(2),
        venta:  nums[1].toFixed(2),
        fecha: new Date().toISOString().slice(0,10),
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({ ok: false, error: 'Sin valores', html_length: html.length });

  } catch(e) {
    // Fallback: leer cotizaciones_basicas.js de 2mas2
    try {
      const r2 = await fetch('https://2mas2.com.uy/includes-valores/cotizaciones/brou/cotizaciones_basicas.js', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://2mas2.com.uy/' }
      });
      if (r2.ok) {
        const js = await r2.text();
        const nums = js.match(/"\s+(\d{2}\.\d{2})\s+"/g) || [];
        const dolar = nums.map(n => parseFloat(n.replace(/[^0-9.]/g,''))).filter(n => n >= 35 && n <= 55);
        if (dolar.length >= 2) {
          return res.status(200).json({
            ok: true, fuente: 'BROU via 2mas2',
            compra: dolar[0].toFixed(2),
            venta:  dolar[1].toFixed(2),
            fecha: new Date().toISOString().slice(0,10),
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch(e2) {}

    return res.status(200).json({ ok: false, error: e.message });
  }
}
