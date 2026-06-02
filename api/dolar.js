// api/dolar.js — Cotización dólar interbancario BROU
// Subir a: lote21-proxy/api/dolar.js en GitHub

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Fuente 1: BCU (Banco Central Uruguay) — cotización oficial
    const bcuRes = await fetch(
      "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/wscotizaciones",
      {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "" },
        body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Execute xmlns="http://tempuri.org/">
      <Moneda>0</Moneda>
      <FechaDesde>${new Date().toISOString().slice(0,10)}</FechaDesde>
      <FechaHasta>${new Date().toISOString().slice(0,10)}</FechaHasta>
      <Grupo>0</Grupo>
    </Execute>
  </soap:Body>
</soap:Envelope>`
      }
    );

    if (bcuRes.ok) {
      const xml = await bcuRes.text();
      // Buscar dólar interbancario (código 2225 = USD interbancario)
      const compraMatch = xml.match(/<COMPRA>([0-9.]+)<\/COMPRA>/);
      const ventaMatch = xml.match(/<VENTA>([0-9.]+)<\/VENTA>/);
      const fechaMatch = xml.match(/<FECHA>([^<]+)<\/FECHA>/);

      if (compraMatch && ventaMatch) {
        return res.status(200).json({
          ok: true,
          fuente: "BCU",
          compra: parseFloat(compraMatch[1]).toFixed(2),
          venta: parseFloat(ventaMatch[1]).toFixed(2),
          fecha: fechaMatch ? fechaMatch[1] : new Date().toISOString().slice(0,10),
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) {}

  // Fuente 2: 2mas2 scraping como fallback
  try {
    const res2 = await fetch(
      "https://2mas2.com.uy/includes-valores/cotizaciones/brou/cotizacion2020-brou.html",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const html = await res2.text();
    
    // Extraer compra y venta del HTML
    const compraMatch = html.match(/compra[^0-9]*([0-9]+[.,][0-9]+)/i);
    const ventaMatch = html.match(/venta[^0-9]*([0-9]+[.,][0-9]+)/i);
    
    if (compraMatch && ventaMatch) {
      return res.status(200).json({
        ok: true,
        fuente: "BROU",
        compra: compraMatch[1].replace(",", "."),
        venta: ventaMatch[1].replace(",", "."),
        fecha: new Date().toISOString().slice(0,10),
        timestamp: new Date().toISOString()
      });
    }
  } catch(e) {}

  // Fuente 3: BCU API REST
  try {
    const today = new Date().toISOString().slice(0,10);
    const bcuApi = await fetch(
      `https://api.bcuonline.com.uy/cotizaciones/v1?moneda=USD&fecha=${today}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (bcuApi.ok) {
      const data = await bcuApi.json();
      if (data && data.compra) {
        return res.status(200).json({
          ok: true,
          fuente: "BCU",
          compra: String(data.compra),
          venta: String(data.venta),
          fecha: today,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) {}

  return res.status(200).json({
    ok: false,
    error: "No se pudo obtener cotización",
    timestamp: new Date().toISOString()
  });
};
