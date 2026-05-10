// api/cron-lunes.js — Cron job lunes 21hs Uruguay (00:00 UTC martes)

export default async function handler(req, res) {
  try {
    // Obtener datos actuales de ACG
    const preciosRes = await fetch("https://lote21-proxy.vercel.app/api/precios?nocache=" + Date.now());
    const d = await preciosRes.json();

    if (!d.ok) throw new Error("No se pudieron obtener los precios");

    const sem        = d.semana || "?";
    const novillo    = d.gordos.novillo    || "—";
    const vaca       = d.gordos.vaca       || "—";
    const vaquillona = d.gordos.vaquillona || "—";
    const novilloAnt    = d.gordos.novilloAnt    || "—";
    const vacaAnt       = d.gordos.vacaAnt       || "—";
    const vaquillonaAnt = d.gordos.vaquillonaAnt || "—";
    const bovinos    = d.faena?.bovinos    ? Number(d.faena.bovinos).toLocaleString("es-UY")    : "—";
    const ovinos     = d.faena?.ovinos     ? Number(d.faena.ovinos).toLocaleString("es-UY")     : "—";
    const bovinosAnt = d.faena?.bovinosAnt ? Number(d.faena.bovinosAnt).toLocaleString("es-UY") : "—";
    const ovinosAnt  = d.faena?.ovinosAnt  ? Number(d.faena.ovinosAnt).toLocaleString("es-UY")  : "—";

    function flecha(actual, ant) {
      const a = parseFloat(actual), b = parseFloat(ant);
      if (isNaN(a) || isNaN(b)) return "";
      if (a > b) return "▲"; if (a < b) return "▼"; return "►";
    }
    function color(actual, ant) {
      const a = parseFloat(actual), b = parseFloat(ant);
      if (isNaN(a) || isNaN(b)) return "#666";
      if (a > b) return "#22b14c"; if (a < b) return "#e63946"; return "#f4a261";
    }

    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" bgcolor="#f4f4f4" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:30px 20px;">
      <table width="600" bgcolor="#ffffff" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">

        <tr><td bgcolor="#1a3a5c" style="padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:white;font-size:26px;font-weight:300;letter-spacing:2px;">MERCADO DE HACIENDA</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">ACG — Semana N° ${sem}</p>
        </td></tr>

        <tr><td style="padding:28px 32px 16px;">
          <p style="margin:0 0 16px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:2px;">Ganado Gordo — US$/kg cuarta balanza</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            ${[["NOVILLO",novillo,novilloAnt],["VACA",vaca,vacaAnt],["VAQUILLONA",vaquillona,vaquillonaAnt]].map(([label,v,a]) => `
            <td width="33%" style="text-align:center;padding:0 6px;">
              <div style="background:#1e3c6e;border-radius:8px;padding:14px 8px;">
                <p style="margin:0 0 6px;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:1px;">${label}</p>
                <p style="margin:0;color:white;font-size:30px;font-weight:300;">${v.replace(".",",")} <span style="color:${color(v,a)};font-size:18px;">${flecha(v,a)}</span></p>
                <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;">ant: ${a.replace(".",",")}</p>
              </div>
            </td>`).join("")}
          </tr></table>
        </td></tr>

        <tr><td style="padding:8px 32px 24px;">
          <p style="margin:0 0 12px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:2px;">Faena Semanal — INAC</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            ${[["BOVINOS",bovinos,bovinosAnt],["OVINOS",ovinos,ovinosAnt]].map(([label,v,a]) => `
            <td width="50%" style="text-align:center;padding:0 6px;">
              <div style="background:#f0f4f8;border-radius:8px;padding:14px 8px;">
                <p style="margin:0 0 6px;color:#666;font-size:11px;letter-spacing:1px;">${label}</p>
                <p style="margin:0;color:#1a3a5c;font-size:26px;font-weight:300;">${v}</p>
                <p style="margin:4px 0 0;color:#999;font-size:11px;">ant: ${a}</p>
              </div>
            </td>`).join("")}
          </tr></table>
        </td></tr>

        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="https://lote21-proxy.vercel.app/api/generar-placa" 
             style="display:inline-block;background:#2d6a4f;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:1px;">
            🖼 Abrir Generador de Placa
          </a>
          <p style="margin:12px 0 0;color:#aaa;font-size:12px;">Hacé click para abrir el generador con los datos ya cargados y descargar la imagen</p>
        </td></tr>

        <tr><td bgcolor="#f8f8f8" style="padding:16px 32px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;color:#aaa;font-size:11px;">Escritorio Aramburu — Sarandí del Yí | www.aramburu.com.uy</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Enviar email con Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Aramburu Mercado <onboarding@resend.dev>",
        to: ["agustin@2mas2.com.uy"],
        subject: `📊 Mercado de Hacienda — Semana N° ${sem}`,
        html: emailHtml
      })
    });

    const emailResult = await emailRes.json();

    return res.status(200).json({
      ok: true,
      semana: sem,
      emailEnviado: emailRes.ok,
      emailResult,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
