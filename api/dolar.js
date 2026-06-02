// api/dolar.js — API publica del BROU
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // API publica del BROU - cotizaciones en tiempo real
    const r = await fetch(
      'https://www.brou.com.uy/o/rest/cotizaciones/hoy',
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    );
    if (r.ok) {
      const data = await r.json();
      // Buscar USD en el array de monedas
      const usd = Array.isArray(data)
        ? data.find(m => m.codigoISO === 'USD' || m.moneda === 'DOLAR' || (m.nombre && /dolar/i.test(m.nombre)))
        : null;
      if (usd) {
        return res.status(200).json({
          ok: true, fuente: 'BROU',
          compra: String(usd.compra || usd.precioCompra || usd.buy || ''),
          venta:  String(usd.venta  || usd.precioVenta  || usd.sell || ''),
          fecha: new Date().toISOString().slice(0,10),
          timestamp: new Date().toISOString(),
          raw: usd
        });
      }
      // Si no encontró, devolver raw para ver estructura
      return res.status(200).json({ ok: false, error: 'USD no encontrado', raw: data });
    }
  } catch(e) { console.log('brou/hoy error:', e.message); }

  try {
    // Alternativa: endpoint de cotizaciones del BROU
    const r2 = await fetch(
      'https://www.brou.com.uy/o/rest/cotizaciones/monedas',
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    );
    if (r2.ok) {
      const data2 = await r2.json();
      return res.status(200).json({ ok: false, error: 'Ver estructura', raw: data2 });
    }
  } catch(e) { console.log('brou/monedas error:', e.message); }

  try {
    // Fallback BCU interbancario
    const fecha = new Date();
    let fechaStr = '';
    for (let i = 0; i <= 5; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      fechaStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const soap = '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza"><soapenv:Header/><soapenv:Body><cot:wsbcucotizaciones.Execute><cot:Entrada><cot:Moneda><cot:item>2225</cot:item></cot:Moneda><cot:FechaDesde>' + fechaStr + '</cot:FechaDesde><cot:FechaHasta>' + fechaStr + '</cot:FechaHasta><cot:Grupo>0</cot:Grupo></cot:Entrada></cot:wsbcucotizaciones.Execute></soapenv:Body></soapenv:Envelope>';
      const r3 = await fetch('https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones', { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' }, body: soap });
      const text = await r3.text();
      const tccM = text.match(/<TCC>([0-9.]+)<\/TCC>/);
      const tcvM = text.match(/<TCV>([0-9.]+)<\/TCV>/);
      if (tccM && tcvM) {
        return res.status(200).json({
          ok: true, fuente: 'BCU Interbancario',
          compra: parseFloat(tccM[1]).toFixed(3),
          venta:  parseFloat(tcvM[1]).toFixed(3),
          fecha: fechaStr,
          nota: 'Precio interbancario BCU (referencia)',
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) {}

  return res.status(200).json({ ok: false, error: 'Sin cotización disponible' });
}
