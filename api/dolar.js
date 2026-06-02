// api/dolar.js — BCU debug full response para 2026-06-01
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  const fecha = '2026-06-01';
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

  try {
    const r = await fetch(
      'https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones',
      { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' }, body: soapBody }
    );
    const text = await r.text();
    // Devolver el XML completo para ver las etiquetas exactas
    return res.status(200).json({ full: text });
  } catch(e) {
    return res.status(200).json({ error: e.message });
  }
}
