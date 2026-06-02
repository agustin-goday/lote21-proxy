// api/dolar.js — BCU SOAP sin namespace en elementos internos
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const hoy = new Date();
    const fecha = hoy.getFullYear() + '-' +
      String(hoy.getMonth()+1).padStart(2,'0') + '-' +
      String(hoy.getDate()).padStart(2,'0');

    // Sin namespace en elementos internos, Execute con xmlns
    const soapBody = '<?xml version="1.0" encoding="utf-8"?>' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<soap:Body>' +
      '<Execute xmlns="http://tempuri.org/">' +
      '<Moneda><item>2225</item></Moneda>' +
      '<FechaDesde>' + fecha + '</FechaDesde>' +
      '<FechaHasta>' + fecha + '</FechaHasta>' +
      '<Grupo>0</Grupo>' +
      '</Execute>' +
      '</soap:Body>' +
      '</soap:Envelope>';

    const r = await fetch(
      'https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '"http://tempuri.org/Execute"'
        },
        body: soapBody
      }
    );

    const text = await r.text();
    console.log('BCU preview:', text.slice(0, 800));

    const compraM = text.match(/<COMPRA>([0-9.,]+)<\/COMPRA>/i);
    const ventaM  = text.match(/<VENTA>([0-9.,]+)<\/VENTA>/i);

    if (compraM && ventaM) {
      return res.status(200).json({
        ok: true,
        fuente: 'BCU',
        compra: compraM[1].replace(',', '.'),
        venta:  ventaM[1].replace(',', '.'),
        fecha: fecha,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      ok: false,
      error: 'Sin valores',
      preview: text.slice(0, 800)
    });

  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
