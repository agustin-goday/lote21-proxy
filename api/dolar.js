// api/dolar.js — Cotización dólar interbancario BROU
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Fuente: BCU cotizaciones
  try {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2,'0');
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const yyyy = today.getFullYear();
    const fechaStr = `${yyyy}-${mm}-${dd}`;

    const bcuRes = await fetch(
      `https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/wscotizaciones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": '""'
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Execute xmlns="http://tempuri.org/">
      <Moneda>0</Moneda>
      <FechaDesde>${fechaStr}</FechaDesde>
      <FechaHasta>${fechaStr}</FechaHasta>
      <Grupo>0</Grupo>
    </Execute>
  </soap:Body>
</soap:Envelope>`
      }
    );

    if (bcuRes.ok) {
      const xml = await bcuRes.text();
      // Buscar USD interbancario
      const bloques = xml.match(/<datoscotizaciones>[\s\S]*?<\/datoscotizaciones>/gi) || [];
      for (const bloque of bloques) {
        const moneda = bloque.match(/<MONEDA>([^<]*)<\/MONEDA>/i);
        const nombre = bloque.match(/<NOMBRE>([^<]*)<\/NOMBRE>/i);
        // Dólar interbancario tiene código 2225 o nombre "DOLAR INTERBANCARIO"
        if (nombre && /dolar.*interbancario/i.test(nombre[1])) {
          const compra = bloque.match(/<COMPRA>([0-9.]+)<\/COMPRA>/i);
          const venta = bloque.match(/<VENTA>([0-9.]+)<\/VENTA>/i);
          if (compra && venta) {
            return res.status(200).json({
              ok: true,
              fuente: "BCU",
              compra: parseFloat(compra[1]).toFixed(2),
              venta: parseFloat(venta[1]).toFixed(2),
              fecha: fechaStr,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      // Si no encontró interbancario, tomar el primero que sea USD
      for (const bloque of bloques) {
        const nombre = bloque.match(/<NOMBRE>([^<]*)<\/NOMBRE>/i);
        if (nombre && /dolar/i.test(nombre[1])) {
          const compra = bloque.match(/<COMPRA>([0-9.]+)<\/COMPRA>/i);
          const venta = bloque.match(/<VENTA>([0-9.]+)<\/VENTA>/i);
          if (compra && venta) {
            return res.status(200).json({
              ok: true,
              fuente: "BCU",
              compra: parseFloat(compra[1]).toFixed(2),
              venta: parseFloat(venta[1]).toFixed(2),
              fecha: fechaStr,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
  } catch(e) {
    console.log("BCU SOAP error:", e.message);
  }

  // Fuente 2: scraping 2mas2 (BROU)
  try {
    const r = await fetch(
      "https://2mas2.com.uy/includes-valores/cotizaciones/brou/cotizacion2020-brou.html",
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; agrodemaria-bot/1.0)" } }
    );
    const html = await r.text();
    const compraM = html.match(/compra[^0-9]{0,20}([0-9]{2}[.,][0-9]{2})/i);
    const ventaM  = html.match(/venta[^0-9]{0,20}([0-9]{2}[.,][0-9]{2})/i);
    if (compraM && ventaM) {
      return res.status(200).json({
        ok: true,
        fuente: "BROU",
        compra: compraM[1].replace(",", "."),
        venta:  ventaM[1].replace(",", "."),
        fecha: new Date().toISOString().slice(0,10),
        timestamp: new Date().toISOString()
      });
    }
  } catch(e) {
    console.log("2mas2 error:", e.message);
  }

  return res.status(200).json({
    ok: false,
    error: "No se pudo obtener cotización del dólar",
    timestamp: new Date().toISOString()
  });
};
