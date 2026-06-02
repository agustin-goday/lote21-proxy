// api/dolar.js — Dolar billete BROU (compra/venta publico)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  function getFecha(daysBack) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  async function consultarBCU(moneda, fecha) {
    const soapBody =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">' +
      '<soapenv:Header/>' +
      '<soapenv:Body>' +
      '<cot:wsbcucotizaciones.Execute>' +
      '<cot:Entrada>' +
      '<cot:Moneda><cot:item>' + moneda + '</cot:item></cot:Moneda>' +
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
    // Intentar últimos 5 días
    for (let i = 0; i <= 5; i++) {
      const fecha = getFecha(i);

      // Moneda 2222 = Dolar USA billete (compra/venta BROU publico)
      // Moneda 2225 = Dolar interbancario (TCC=TCV, precio referencia)
      // Probar 2222 primero, fallback a 2225
      let text = await consultarBCU('2222', fecha);
      let tccM = text.match(/<TCC>([0-9.]+)<\/TCC>/);
      let tcvM = text.match(/<TCV>([0-9.]+)<\/TCV>/);

      // Si 2222 no tiene datos, probar 2225
      if (!tccM || !tcvM) {
        text = await consultarBCU('2225', fecha);
        tccM = text.match(/<TCC>([0-9.]+)<\/TCC>/);
        tcvM = text.match(/<TCV>([0-9.]+)<\/TCV>/);
      }

      if (tccM && tcvM) {
        const compra = parseFloat(tccM[1]);
        const venta  = parseFloat(tcvM[1]);

        // Si compra == venta es interbancario, mostrar igual
        return res.status(200).json({
          ok: true,
          fuente: 'BCU',
          compra: compra.toFixed(2),
          venta:  venta.toFixed(2),
          fecha:  fecha,
          esInterbancario: compra === venta,
          timestamp: new Date().toISOString()
        });
      }
    }
    return res.status(200).json({ ok: false, error: 'Sin cotización' });

  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
