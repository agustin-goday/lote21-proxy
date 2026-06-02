// api/dolar.js — Scraping directo del portal BROU (mismo método que actualiza_brou.php)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  // URL exacta que usa actualiza_brou.php
  const BROU_URL = 'https://www.brou.com.uy/c/portal/render_portlet?p_l_id=20593&p_p_id=cotizacionfull_WAR_broutmfportlet_INSTANCE_otHfewh1klyS&p_p_lifecycle=0&p_t_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_pos=0&p_p_col_count=2&p_p_isolated=1&currentURL=%2Fweb%2Fguest%2Fcotizaciones';

  try {
    const r = await fetch(BROU_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-UY,es;q=0.9',
        'Referer': 'https://www.brou.com.uy/web/guest/cotizaciones'
      }
    });

    if (r.ok) {
      const html = await r.text();
      console.log('BROU html length:', html.length, 'status:', r.status);

      // Extraer todas las celdas <td> con números de cotización
      // El PHP toma: fila 1 cols 2,3,4,5 = dólar compra/venta billete/transferencia
      const tdMatches = html.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
      const valores = tdMatches
        .map(td => td.replace(/<[^>]+>/g, '').trim())
        .filter(v => /^\d{1,3}[,.]?\d{0,4}$/.test(v.trim()) && parseFloat(v.replace(',','.')) > 0);

      console.log('Valores TD encontrados:', valores.slice(0, 20));

      // Buscar específicamente patrones de dólar (30-60 rango)
      const numeros = html.match(/\b\d{2}[,.]\d{2,4}\b/g) || [];
      const dolar = numeros
        .map(n => parseFloat(n.replace(',','.')))
        .filter(n => n >= 35 && n <= 55);

      console.log('Numeros dolar rango:', dolar.slice(0, 10));

      if (dolar.length >= 2) {
        dolar.sort((a, b) => a - b);
        return res.status(200).json({
          ok: true, fuente: 'BROU',
          compra: dolar[0].toFixed(2),
          venta: dolar[dolar.length - 1].toFixed(2),
          fecha: new Date().toISOString().slice(0,10),
          timestamp: new Date().toISOString()
        });
      }

      // Debug: ver qué tiene el HTML
      return res.status(200).json({
        ok: false,
        error: 'Sin valores dólar',
        html_length: html.length,
        numeros_encontrados: numeros.slice(0, 30),
        html_sample: html.slice(0, 2000)
      });
    }

    return res.status(200).json({ ok: false, error: 'BROU no responde', status: r.status });

  } catch(e) {
    console.log('BROU scrape error:', e.message);

    // Fallback: leer cotizaciones_basicas.js de 2mas2
    try {
      const r2 = await fetch('https://2mas2.com.uy/includes-valores/cotizaciones/brou/cotizaciones_basicas.js', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://2mas2.com.uy/' }
      });
      if (r2.ok) {
        const js = await r2.text();
        console.log('cotizaciones_basicas.js:', js.slice(0, 300));
        // Formato: +"   39.15  " y +"   41.55  "
        const nums = js.match(/"\s+(\d{2}\.\d{2})\s+"/g) || [];
        const precios = nums.map(n => parseFloat(n.replace(/[^0-9.]/g,'')));
        const dolar = precios.filter(n => n >= 35 && n <= 55);
        if (dolar.length >= 2) {
          return res.status(200).json({
            ok: true, fuente: 'BROU via 2mas2',
            compra: dolar[0].toFixed(2),
            venta: dolar[1].toFixed(2),
            fecha: new Date().toISOString().slice(0,10),
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch(e2) { console.log('2mas2 js error:', e2.message); }

    return res.status(200).json({ ok: false, error: e.message });
  }
}
