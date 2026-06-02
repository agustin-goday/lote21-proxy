// api/dolar.js — Dolar BCU API REST publica
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // API publica del BCU - devuelve JSON con cotizaciones del dia
    // Moneda 2225 = Dolar Interbancario
    const hoy = new Date();
    const fecha = hoy.toISOString().slice(0, 10);

    const url = "https://apis.uy/api/v1/bcuCotizaciones?moneda=2225&fecha=" + fecha;
    const r = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (r.ok) {
      const data = await r.json();
      // Estructura: { cotizaciones: [{ compra, venta, fecha, moneda }] }
      if (data && data.cotizaciones && data.cotizaciones.length > 0) {
        const c = data.cotizaciones[0];
        return res.status(200).json({
          ok: true,
          fuente: "BCU",
          compra: String(c.compra || c.precioCompra || ""),
          venta: String(c.venta || c.precioVenta || ""),
          fecha: fecha,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) {
    console.log("apis.uy error:", e.message);
  }

  try {
    // Fallback: dolarito.uy API - cotizacion BROU
    const r2 = await fetch("https://dolarito.uy/api/frontend/history/0", {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
    });
    if (r2.ok) {
      const data2 = await r2.json();
      // Buscar BROU en el array
      const brou = Array.isArray(data2) ? data2.find(function(x) {
        return x.name && /brou/i.test(x.name);
      }) : null;
      if (brou && brou.buy && brou.sell) {
        return res.status(200).json({
          ok: true,
          fuente: "BROU via dolarito.uy",
          compra: String(brou.buy),
          venta: String(brou.sell),
          fecha: new Date().toISOString().slice(0, 10),
          timestamp: new Date().toISOString()
        });
      }
      // Si no encontro BROU tomar el primero
      if (Array.isArray(data2) && data2[0] && data2[0].buy) {
        return res.status(200).json({
          ok: true,
          fuente: data2[0].name || "dolarito.uy",
          compra: String(data2[0].buy),
          venta: String(data2[0].sell),
          fecha: new Date().toISOString().slice(0, 10),
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) {
    console.log("dolarito error:", e.message);
  }

  try {
    // Fallback 2: exchangerate-api (dolar generico)
    const r3 = await fetch("https://open.er-api.com/v6/latest/USD");
    if (r3.ok) {
      const data3 = await r3.json();
      if (data3 && data3.rates && data3.rates.UYU) {
        const tc = data3.rates.UYU;
        return res.status(200).json({
          ok: true,
          fuente: "ExchangeRate",
          compra: (tc * 0.985).toFixed(2),
          venta: (tc * 1.015).toFixed(2),
          fecha: new Date().toISOString().slice(0, 10),
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) {
    console.log("exchangerate error:", e.message);
  }

  return res.status(200).json({
    ok: false,
    error: "No se pudo obtener cotizacion",
    timestamp: new Date().toISOString()
  });
};
