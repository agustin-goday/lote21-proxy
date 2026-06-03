// api/dolar.js — USD via BROU portlet (estable) + otras via BCU SOAP
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(200).end();

  function fmt2(v) {
    const n = parseFloat(String(v || '').replace(',', '.'));
    return isNaN(n) ? null : n.toFixed(2);
  }

  const cotizaciones = { usd: null, eur: null, ars: null, brl: null };
  let ui = null, ur = null;
  const hoy = new Date();

  // ── USD: portlet BROU (siempre funciona) ──
  try {
    const portletUrl = "https://www.brou.com.uy/c/portal/render_portlet?p_l_id=20593&p_p_id=cotizacionfull_WAR_broutmfportlet_INSTANCE_otHfewh1klyS&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_pos=0&p_p_col_count=1";
    const html = await fetch(portletUrl, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
    }).then(r => r.text());
    const nums = html.match(/\d{2},\d{4,5}/g);
    if (nums && nums.length >= 2) {
      cotizaciones.usd = {
        compra: fmt2(nums[0].replace(',','.')),
        venta:  fmt2(nums[1].replace(',','.'))
      };
    }
  } catch(_) {}

  // ── EUR, ARS, BRL, UI, UR: BCU SOAP ──
  try {
    const dd = String(hoy.getDate()).padStart(2,'0');
    const mm = String(hoy.getMonth()+1).padStart(2,'0');
    const yyyy = hoy.getFullYear();
    const soapBody = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><Execute xmlns="http://cotizaciones.bcu.gub.uy/"><Entrada><Moneda><int>2227</int><int>500</int><int>2224</int><int>10001</int><int>10002</int></Moneda><FechaDesde>${yyyy}-${mm}-${dd}</FechaDesde><FechaHasta>${yyyy}-${mm}-${dd}</FechaHasta><Grupo>0</Grupo></Entrada></Execute></soap:Body></soap:Envelope>`;

    const soapRes = await fetch(
      "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones",
      {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "Execute", "User-Agent": "Mozilla/5.0" },
        body: soapBody
      }
    );

    if (soapRes.ok) {
      const xml = await soapRes.text();
      // Parsear cada moneda del XML
      const MONEDA_MAP = { '2227':'eur', '500':'ars', '2224':'brl' };
      const blocks = [...xml.matchAll(/<datoscotizaciones>([\s\S]*?)<\/datoscotizaciones>/gi)];
      blocks.forEach(b => {
        const monedaM = b[1].match(/<Moneda>(\d+)<\/Moneda>/i);
        const tccM = b[1].match(/<TCC>([\d.]+)<\/TCC>/i);
        const tcvM = b[1].match(/<TCV>([\d.]+)<\/TCV>/i);
        if (!monedaM) return;
        const cod = monedaM[1];
        const key = MONEDA_MAP[cod];
        if (key && tccM && tcvM) {
          cotizaciones[key] = { compra: fmt2(tccM[1]), venta: fmt2(tcvM[1]) };
        }
        // UI (10001) y UR (10002)
        if (cod === '10001' && tcvM) ui = fmt2(tcvM[1]);
        if (cod === '10002' && tcvM) ur = fmt2(tcvM[1]);
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
    venta:  usd.venta  || null,
    cotizaciones,
    ui,
    ur,
    timestamp: new Date().toISOString()
  });
}
