// api/dolar.js — scraping 2mas2 + fallback BCU
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Fuente 1: 2mas2 scraping del widget BROU
  try {
    const r = await fetch(
      'https://2mas2.com.uy/includes-valores/cotizaciones/brou/cotizacion2020-brou.html',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://2mas2.com.uy/'
        }
      }
    );
    if (r.ok) {
      const html = await r.text();
      console.log('2mas2 html length:', html.length);
      console.log('2mas2 preview:', html.slice(0, 500));

      // Buscar patrones numéricos de cotización (ej: 39.15, 41.55)
      // El widget tiene números entre 35 y 50 para el dólar
      const matches = html.match(/\d{2}\.\d{2,3}/g) || [];
      const precios = matches
        .map(n => parseFloat(n))
        .filter(n => n >= 35 && n <= 55);

      console.log('Precios encontrados:', precios);

      if (precios.length >= 2) {
        // Ordenar: el menor es compra, el mayor es venta
        precios.sort((a, b) => a - b);
        return res.status(200).json({
          ok: true, fuente: 'BROU',
          compra: precios[0].toFixed(2),
          venta:  precios[precios.length - 1].toFixed(2),
          fecha: new Date().toISOString().slice(0,10),
          timestamp: new Date().toISOString()
        });
      }

      // Debug: devolver el HTML para ver qué tiene
      return res.status(200).json({
        ok: false, error: 'Sin precios en 2mas2',
        html_length: html.length,
        matches_raw: matches.slice(0, 20),
        html_sample: html.slice(0, 1000)
      });
    }
  } catch(e) { console.log('2mas2 error:', e.message); }

  // Fuente 2: BCU interbancario como fallback
  try {
    for (let i = 1; i <= 5; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const fecha = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const soap = '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza"><soapenv:Header/><soapenv:Body><cot:wsbcucotizaciones.Execute><cot:Entrada><cot:Moneda><cot:item>2225</cot:item></cot:Moneda><cot:FechaDesde>' + fecha + '</cot:FechaDesde><cot:FechaHasta>' + fecha + '</cot:FechaHasta><cot:Grupo>0</cot:Grupo></cot:Entrada></cot:wsbcucotizaciones.Execute></soapenv:Body></soapenv:Envelope>';
      const r = await fetch('https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones', {
        method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' }, body: soap
      });
      const text = await r.text();
      const tcc = text.match(/<TCC>([0-9.]+)<\/TCC>/);
      const tcv = text.match(/<TCV>([0-9.]+)<\/TCV>/);
      if (tcc && tcv && parseFloat(tcc[1]) > 0) {
        return res.status(200).json({
          ok: true, fuente: 'BCU Interbancario',
          compra: parseFloat(tcc[1]).toFixed(2),
          venta:  parseFloat(tcv[1]).toFixed(2),
          fecha: fecha, nota: 'Referencia BCU',
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) {}

  return res.status(200).json({ ok: false, error: 'Sin cotización disponible' });
}
