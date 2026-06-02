// api/dolar.js — Dolar BCU / dolarito.uy
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Fuente 1: apis.uy wrapper BCU
    const hoy = new Date().toISOString().slice(0, 10);
    const r = await fetch("https://apis.uy/api/v1/bcuCotizaciones?moneda=2225&fecha=" + hoy, {
      headers: { "Accept": "application/json" }
    });
    if (r.ok) {
      const data = await r.json();
      if (data && data.cotizaciones && data.cotizaciones.length > 0) {
        const c = data.cotizaciones[0];
        return res.status(200).json({
          ok: true, fuente: "BCU",
          compra: String(c.compra || c.precioCompra || ""),
          venta: String(c.venta || c.precioVenta || ""),
          fecha: hoy, timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) { console.log("apis.uy:", e.message); }

  try {
    // Fuente 2: dolarito.uy
    const r2 = await fetch("https://dolarito.uy/api/frontend/history/0", {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
    });
    if (r2.ok) {
      const data2 = await r2.json();
      const brou = Array.isArray(data2) ? data2.find(x => x.name && /brou/i.test(x.name)) : null;
      const src = brou || (Array.isArray(data2) ? data2[0] : null);
      if (src && src.buy) {
        return res.status(200).json({
          ok: true, fuente: src.name || "dolarito.uy",
          compra: String(src.buy), venta: String(src.sell),
          fecha: new Date().toISOString().slice(0, 10),
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) { console.log("dolarito:", e.message); }

  try {
    // Fuente 3: open exchange rates
    const r3 = await fetch("https://open.er-api.com/v6/latest/USD");
    if (r3.ok) {
      const data3 = await r3.json();
      if (data3 && data3.rates && data3.rates.UYU) {
        const tc = data3.rates.UYU;
        return res.status(200).json({
          ok: true, fuente: "ExchangeRate",
          compra: (tc * 0.985).toFixed(2),
          venta: (tc * 1.015).toFixed(2),
          fecha: new Date().toISOString().slice(0, 10),
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch(e) { console.log("exchangerate:", e.message); }

  return res.status(200).json({
    ok: false, error: "No se pudo obtener cotizacion",
    timestamp: new Date().toISOString()
  });
}
