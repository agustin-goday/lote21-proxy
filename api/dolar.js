// api/dolar.js — BCU API oficial
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // API REST oficial BCU - sin autenticacion
    // https://cotizaciones.bcu.gub.uy
    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2,'0');
    const mm = String(hoy.getMonth()+1).padStart(2,'0');
    const yyyy = hoy.getFullYear();

    // Formato que espera el BCU: YYYY-MM-DD
    const fecha = yyyy + '-' + mm + '-' + dd;

    const url = 'https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/wscotizaciones?Moneda=2225&FechaDesde=' + fecha + '&FechaHasta=' + fecha + '&Grupo=0';

    const r = await fetch(url, {
      headers: { 'Accept': 'application/json, text/plain, */*' }
    });

    const text = await r.text();
    console.log('BCU response status:', r.status, 'length:', text.length);
    console.log('BCU response preview:', text.slice(0, 300));

    // Intentar parsear JSON
    try {
      const data = JSON.parse(text);
      console.log('BCU JSON keys:', Object.keys(data));
      // Buscar compra/venta en la respuesta
      const str = JSON.stringify(data).toLowerCase();
      const compraM = str.match(/"compra"\s*:\s*"?([0-9.]+)"?/);
      const ventaM  = str.match(/"venta"\s*:\s*"?([0-9.]+)"?/);
      if (compraM && ventaM) {
        return res.status(200).json({
          ok: true, fuente: 'BCU',
          compra: parseFloat(compraM[1]).toFixed(2),
          venta: parseFloat(ventaM[1]).toFixed(2),
          fecha: fecha,
          timestamp: new Date().toISOString()
        });
      }
    } catch(e) {
      // No era JSON, puede ser XML
      console.log('Not JSON, trying XML');
    }

    // Parsear XML
    const compraM = text.match(/<COMPRA>([0-9.]+)<\/COMPRA>/i);
    const ventaM  = text.match(/<VENTA>([0-9.]+)<\/VENTA>/i);
    if (compraM && ventaM) {
      return res.status(200).json({
        ok: true, fuente: 'BCU',
        compra: parseFloat(compraM[1]).toFixed(2),
        venta: parseFloat(ventaM[1]).toFixed(2),
        fecha: fecha,
        timestamp: new Date().toISOString()
      });
    }

    // Devolver respuesta raw para debug
    return res.status(200).json({
      ok: false,
      error: 'No se encontraron valores en respuesta BCU',
      status: r.status,
      preview: text.slice(0, 500)
    });

  } catch(e) {
    return res.status(200).json({
      ok: false,
      error: e.message
    });
  }
}
