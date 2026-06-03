// api/dolar.js — DEBUG VERSION
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  const debug = [];
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2,'0');
  const mm = String(hoy.getMonth()+1).padStart(2,'0');
  const yyyy = hoy.getFullYear();
  const fechaISO = `${yyyy}-${mm}-${dd}`;

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://cotizaciones.bcu.gub.uy/">
  <soap:Body>
    <tns:Execute>
      <tns:Entrada>
        <tns:Moneda><tns:ArrayOfint><item>2225</item><item>2227</item><item>500</item><item>2224</item></tns:ArrayOfint></tns:Moneda>
        <tns:FechaDesde>${fechaISO}</tns:FechaDesde>
        <tns:FechaHasta>${fechaISO}</tns:FechaHasta>
        <tns:Grupo>0</tns:Grupo>
      </tns:Entrada>
    </tns:Execute>
  </soap:Body>
</soap:Envelope>`;

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
        body: soapBody
      }
    );
    debug.push({ step: "soap_status", status: soapRes.status, ok: soapRes.ok });
    const xml = await soapRes.text();
    debug.push({ step: "soap_xml_length", len: xml.length, preview: xml.substring(0, 300) });
  } catch(e) {
    debug.push({ step: "soap_error", error: e.message });
  }

  // También probar el portlet USD para comparar
  try {
    const portletUrl = "https://www.brou.com.uy/c/portal/render_portlet?p_l_id=20593&p_p_id=cotizacionfull_WAR_broutmfportlet_INSTANCE_otHfewh1klyS&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_pos=0&p_p_col_count=1";
    const portRes = await fetch(portletUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await portRes.text();
    debug.push({ step: "portlet_status", status: portRes.status, html_len: html.length, preview: html.substring(0, 200) });
  } catch(e) {
    debug.push({ step: "portlet_error", error: e.message });
  }

  return res.status(200).json({ ok: true, debug, timestamp: new Date().toISOString() });
}
