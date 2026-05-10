// api/remates-anteriores.js — Lista los últimos remates de Plaza Rural con Aramburu

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate"); // cache 24hs

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Leer página de remates para obtener el número actual
    const listRes = await fetch("https://plazarural.com.uy/remates", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
    });
    const listHtml = await listRes.text();
    const numeroMatch = listHtml.match(/\/remates\/(\d+)/);
    const numeroActual = numeroMatch ? parseInt(numeroMatch[1]) : null;
    if (!numeroActual) throw new Error("No se encontró número de remate");

    // Obtener el número del próximo remate de Aramburu desde el proxy
    const aramburuRes = await fetch("https://lote21-proxy.vercel.app/api/plazarural", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
    });
    const aramburuData = await aramburuRes.json();
    const numeroAramburu = aramburuData.ok ? parseInt(aramburuData.numero) : null;

    // Usar el número de Aramburu como base — los anteriores son los remates ya pasados
    const base = numeroAramburu || numeroActual;

    // Generar lista de últimos 10 remates anteriores al de Aramburu
    const remates = [];
    for (let i = 1; i <= 10; i++) {
      const num = base - i;
      if (num < 1) break;
      remates.push({
        numero: num,
        urlLotes:     `https://plazarural.com.uy/remates/${num}?_token=dxAkpnxQnWSIWopkJYMpHAiHkT58qV1uxQYFy9RV&categoria_id=&filtro_condicion=&escritorio_id=7&departamento_id=&inspector_id=&lote_especial_id=&nro_lote=&nro_inspeccion=`,
        urlPromedios: `https://plazarural.com.uy/promedios`,
      });
    }

    return res.status(200).json({
      ok: true,
      numeroActual: base,
      remates,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
