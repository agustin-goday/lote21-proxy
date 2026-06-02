// api/dolar.js — buscar todos los codigos USD disponibles
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Consultar con Grupo=0 y moneda 0 = todas las monedas
  // para el 2026-06-01 que sabemos que tiene datos
  const fecha = '2026-06-01';
  const soapBody =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">' +
    '<soapenv:Header/>' +
    '<soapenv:Body>' +
    '<cot:wsbcucotizaciones.Execute>' +
    '<cot:Entrada>' +
    '<cot:Moneda><cot:item>0</cot:item></cot:Moneda>' +
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

    // Extraer todos los datoscotizaciones.dato que sean USD con TCC != TCV
    const bloques = text.match(/<datoscotizaciones\.dato[\s\S]*?<\/datoscotizaciones\.dato>/gi) || [];
    const usd = bloques
      .filter(b => b.includes('DLS') || b.includes('USD') || b.includes('2225') || b.includes('2222') || b.includes('222'))
      .map(b => {
        const moneda = (b.match(/<Moneda>(\d+)<\/Moneda>/) || [])[1];
        const nombre = (b.match(/<Nombre>([^<]+)<\/Nombre>/) || [])[1];
        const emisor = (b.match(/<Emisor>([^<]+)<\/Emisor>/) || [])[1];
        const tcc = (b.match(/<TCC>([^<]+)<\/TCC>/) || [])[1];
        const tcv = (b.match(/<TCV>([^<]+)<\/TCV>/) || [])[1];
        return { moneda, nombre, emisor, tcc, tcv };
      });

    return res.status(200).json({ total_bloques: bloques.length, usd_encontrados: usd });
  } catch(e) {
    return res.status(200).json({ error: e.message });
  }
}
