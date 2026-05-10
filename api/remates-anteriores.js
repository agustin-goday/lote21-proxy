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

    // Generar lista de últimos 10 remates anteriores (excluye el actual)
    const remates = [];
    for (let i = 1; i <= 10; i++) {
      const num = numeroActual - i;
      if (num < 1) break;
      remates.push({
        numero: num,
        urlLotes:     `https://plazarural.com.uy/remates/${num}?_token=dxAkpnxQnWSIWopkJYMpHAiHkT58qV1uxQYFy9RV&categoria_id=&filtro_condicion=&escritorio_id=7&departamento_id=&inspector_id=&lote_especial_id=&nro_lote=&nro_inspeccion=`,
        urlPromedios: `https://plazarural.com.uy/promedios?nro_remate=${num}`,
      });
    }

    return res.status(200).json({
      ok: true,
      numeroActual,
      remates,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
