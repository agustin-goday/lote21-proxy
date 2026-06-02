// api/dolar.js — BCU SOAP endpoint correcto
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2,'0');
    const mm = String(hoy.getMonth()+1).padStart(2,'0');
    const yyyy = hoy.getFullYear();
    const fecha = yyyy + '-' + mm + '-' + dd;

    // Endpoint correcto: awsbcucotizaciones (no wscotizaciones)
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Execute xmlns="http://tempuri.org/">
      <Entrada>
        <Moneda><item>2225</item></Moneda>
        <FechaDesde>${fecha}</FechaDesde>
        <FechaHasta>${fecha}</FechaHasta>
        <Grupo>0</Grupo>
      </Entrada>
    </Execute>
  </soap:Body>
</soap:Envelope>`;

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
    console.log('BCU status:', r.status, 'len:', text.length);
    console.log('BCU preview:', text.slice(0, 500));

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

    // Si no encontro valores devolver preview para debug
    return res.status(200).json({
      ok: false,
      error: 'Sin valores',
      status: r.status,
      preview: text.slice(0, 600)
    });

  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
