// api/dolar.js — USD via BROU portlet + EUR/ARS/BRL via BCU SOAP + UI/UR
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(200).end();

  function fmt2(v) {
    const n = parseFloat(String(v || '').replace(',', '.'));
    return isNaN(n) ? null : n.toFixed(2);
  }

  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2,'0');
  const mm = String(hoy.getMonth()+1).padStart(2,'0');
  const yyyy = hoy.getFullYear();
  const fechaISO = `${yyyy}-${mm}-${dd}`;

  // SOAP body para BCU — monedas: 2225=USD, 2227=EUR, 500=ARS, 2224=BRL, 10001=UI, 10002=UR
  function makeSoap(monedas) {
    const items = monedas.map(m => `<item>${m}</item>`).join('');
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://cotizaciones.bcu.gub.uy/">
  <soap:Body>
    <tns:Execute>
      <tns:Entrada>
        <tns:Moneda><tns:ArrayOfint>${items}</tns:ArrayOfint></tns:Moneda>
        <tns:FechaDesde>${fechaISO}</tns:FechaDesde>
        <tns:FechaHasta>${fechaISO}</tns:FechaHasta>
        <tns:Grupo>0</tns:Grupo>
      </tns:Entrada>
    </tns:Execute>
  </soap:Body>
</soap:Envelope>`;
  }

  const cotizaciones = { usd: null, eur: null, ars: null, brl: null };
  let ui = null, ur = null;

  // ── BCU SOAP ──
  try {
    const soapRes = await fetch(
      "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": "",
          "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0"
        },
        body: makeSoap([2225, 2227, 500, 2224, 10001, 10002])
      }
    );

    if (soapRes.ok) {
      const xml = await soapRes.text();

      // Parsear XML manualmente — extraer bloques <datoscotizaciones>
      const blocks = [...xml.matchAll(/<datoscotizaciones>([\s\S]*?)<\/datoscotizaciones>/gi)];

      const MONEDA_MAP = {
        '2225': 'usd', '2227': 'eur', '500': 'ars', '2224': 'brl',
        '10001': 'ui', '10002': 'ur'
      };

      blocks.forEach(block => {
        const content = block[1];
        const moneda = (content.match(/<Moneda>(\d+)<\/Moneda>/i) || [])[1];
        const compraRaw = (content.match(/<TCC>([\d.,]+)<\/TCC>/i) || [])[1];
        const ventaRaw  = (content.match(/<TCV>([\d.,]+)<\/TCV>/i) || [])[1];

        const key = MONEDA_MAP[moneda];
        if (!key) return;

        if (key === 'ui') { ui = fmt2(ventaRaw || compraRaw); return; }
        if (key === 'ur') { ur = fmt2(ventaRaw || compraRaw); return; }

        const compra = fmt2(compraRaw);
        const venta  = fmt2(ventaRaw);
        if (compra && venta) cotizaciones[key] = { compra, venta };
      });
    }
  } catch(e) {
    console.log("BCU SOAP error:", e.message);
  }

  // ── Fallback USD: portlet BROU ──
  if (!cotizaciones.usd) {
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
  }

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
