// api/dolar.js — BCU SOAP debug
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  function getFecha(daysBack) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  async function consultarBCU(fecha) {
    const soapBody =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">' +
      '<soapenv:Header/>' +
      '<soapenv:Body>' +
      '<cot:wsbcucotizaciones.Execute>' +
      '<cot:Entrada>' +
      '<cot:Moneda><cot:item>2225</cot:item></cot:Moneda>' +
      '<cot:FechaDesde>' + fecha + '</cot:FechaDesde>' +
      '<cot:FechaHasta>' + fecha + '</cot:FechaHasta>' +
      '<cot:Grupo>0</cot:Grupo>' +
      '</cot:Entrada>' +
      '</cot:wsbcucotizaciones.Execute>' +
      '</soapenv:Body>' +
      '</soapenv:Envelope>';

    const r = await fetch(
      'https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones',
      { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' }, body: soapBody }
    );
    return r.text();
  }

  try {
    const resultados = [];
    for (let i = 0; i <= 5; i++) {
      const fecha = getFecha(i);
      const text = await consultarBCU(fecha);
      
      const compraM = text.match(/<COMPRA>([0-9.,]+)<\/COMPRA>/i);
      const ventaM  = text.match(/<VENTA>([0-9.,]+)<\/VENTA>/i);

      resultados.push({
        fecha: fecha,
        tieneCompra: !!compraM,
        tieneVenta: !!ventaM,
        compra: compraM ? compraM[1] : null,
        venta: ventaM ? ventaM[1] : null,
        preview: text.slice(200, 600)
      });

      if (compraM && ventaM) {
        return res.status(200).json({
          ok: true,
          fuente: 'BCU',
          compra: compraM[1].replace(',', '.'),
          venta: ventaM[1].replace(',', '.'),
          fecha: fecha,
          timestamp: new Date().toISOString()
        });
      }
    }
    return res.status(200).json({ ok: false, debug: resultados });

  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
