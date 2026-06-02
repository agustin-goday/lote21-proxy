// api/dolar.js — Cotización dólar BROU
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const r = await fetch(
      "https://2mas2.com.uy/includes-valores/cotizaciones/brou/cotizacion2020-brou.html",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const html = await r.text();

    // Buscar patrones de precio: números como 43.50 o 43,50
    const nums = html.match(/\d{2}[.,]\d{2}/g) || [];
    
    // Tomar los dos primeros números distintos que parezcan cotizaciones del dólar (entre 30 y 60)
    const precios = nums
      .map(function(n) { return parseFloat(n.replace(",", ".")); })
      .filter(function(n) { return n > 30 && n < 70; });

    if (precios.length >= 2) {
      return res.status(200).json({
        ok: true,
        fuente: "BROU",
        compra: precios[0].toFixed(2),
        venta: precios[1].toFixed(2),
        fecha: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString()
      });
    }

    // Si no encontró, buscar con regex más específico
    const compraM = html.match(/compra[\s\S]{0,30}?(\d{2}[.,]\d{2})/i);
    const ventaM  = html.match(/venta[\s\S]{0,30}?(\d{2}[.,]\d{2})/i);
    if (compraM && ventaM) {
      return res.status(200).json({
        ok: true,
        fuente: "BROU",
        compra: compraM[1].replace(",", "."),
        venta:  ventaM[1].replace(",", "."),
        fecha: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      ok: false,
      error: "No se encontraron valores",
      html_length: html.length
    });

  } catch(e) {
    return res.status(200).json({
      ok: false,
      error: e.message
    });
  }
};
