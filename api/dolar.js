// api/dolar.js — BCU SOAP formato correcto
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2,'0');
    const mm = String(hoy.getMonth()+1).padStart(2,'0');
    const yyyy = hoy.getFullYear();
    // BCU acepta formato YYYY-MM-DD como xsd:date
    const fecha = yyyy + '-' + mm + '-' + dd;

    // Estructura correcta sin wrapper <Entrada>
    const soapBody = '<?xml version="1.0" encoding="utf-8"?>' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">' +
      '<soap:Body>' +
      '<tns:Execute>' +
      '<tns:Moneda><tns:item>2225</tns:item></tns:Moneda>' +
      '<tns:FechaDesde>' + fecha + '</tns:FechaDesde>' +
      '<tns:FechaHasta>' + fecha + '</tns:FechaHasta>' +
      '<tns:Grupo>0</tns:Grupo>' +
      '</tns:Execute>' +
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
    console.log('preview:', text.slice(0, 800));

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
