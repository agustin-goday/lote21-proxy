// api/dolar.js — USD via portlet BROU + otras monedas via BCU POST + UI/UR
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(200).end();

  function fmt2(v) {
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n.toFixed(2);
  }

  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2,'0');
  const mm = String(hoy.getMonth()+1).padStart(2,'0');
  const yyyy = hoy.getFullYear();
  const fechaStr = `${dd}/${mm}/${yyyy}`;

  // Resultados
  const cotizaciones = { usd: null, eur: null, ars: null, brl: null };
  let ui = null, ur = null;

  // ── 1. BCU API — todas las monedas en un solo request ──
  // Códigos BCU: USD=2225, EUR=2227, ARS=500, BRL=2224
  const MONEDAS_BCU = [
    { key: 'usd', cod: 2225 },
    { key: 'eur', cod: 2227 },
    { key: 'ars', cod: 500  },
    { key: 'brl', cod: 2224 },
  ];

  try {
    // BCU endpoint SOAP/JSON
    const bcuBody = JSON.stringify({
      "Moneda": MONEDAS_BCU.map(m => m.cod),
      "FechaDesde": fechaStr,
      "FechaHasta": fechaStr,
      "Grupo": 0
    });

    const bcuRes = await fetch("https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/consultarcotizaciones", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
        "Accept": "application/json"
      },
      body: bcuBody
    });

    if (bcuRes.ok) {
      const bcuData = await bcuRes.json();
      // Respuesta: { "valores": [{ "Moneda": 2225, "TCC": 41.45, "TCV": 41.45, ... }] }
      const valores = bcuData.valores || bcuData.Valores || [];
      valores.forEach(v => {
        const cod = v.Moneda || v.moneda;
        const compra = fmt2(v.TCC || v.tcc || v.Compra || v.compra);
        const venta = fmt2(v.TCV || v.tcv || v.Venta || v.venta);
        const found = MONEDAS_BCU.find(m => m.cod === cod);
        if (found && compra && venta) {
          cotizaciones[found.key] = { compra, venta };
        }
      });
    }
  } catch(_) {}

  // ── 2. Fallback USD: portlet BROU si BCU no dio resultado ──
  if (!cotizaciones.usd) {
    try {
      const portletUrl = "https://www.brou.com.uy/c/portal/render_portlet?p_l_id=20593&p_p_id=cotizacionfull_WAR_broutmfportlet_INSTANCE_otHfewh1klyS&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_pos=0&p_p_col_count=1";
      const html = await fetch(portletUrl, {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
      }).then(r => r.text());
      const nums = html.match(/\d{2},\d{4,5}/g);
      if (nums && nums.length >= 2) {
        cotizaciones.usd = {
          compra: fmt2(nums[0].replace(',', '.')),
          venta: fmt2(nums[1].replace(',', '.'))
        };
      }
    } catch(_) {}
  }

  // ── 3. UI / UR via BCU endpoint específico ──
  try {
    const uiRes = await fetch(
      `https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/consultarcotizaciones`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({ "Moneda": [10001, 10002], "FechaDesde": fechaStr, "FechaHasta": fechaStr, "Grupo": 0 })
      }
    );
    if (uiRes.ok) {
      const uiData = await uiRes.json();
      const vals = uiData.valores || uiData.Valores || [];
      vals.forEach(v => {
        const cod = v.Moneda || v.moneda;
        const val = v.TCV || v.tcv || v.Valor || v.valor;
        if (cod === 10001 && val) ui = parseFloat(val).toFixed(4);
        if (cod === 10002 && val) ur = parseFloat(val).toFixed(2);
      });
    }
  } catch(_) {}

  const usd = cotizaciones.usd || {};
  const fecha = hoy.toLocaleDateString('es-UY', { day: 'numeric', month: 'long' });

  return res.status(200).json({
    ok: true,
    fuente: "BCU/BROU",
    fecha,
    compra: usd.compra || null,
    venta: usd.venta || null,
    cotizaciones,
    ui,
    ur,
    timestamp: new Date().toISOString()
  });
}
